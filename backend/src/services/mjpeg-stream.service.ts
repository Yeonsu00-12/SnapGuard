import { spawn, ChildProcess, exec } from "child_process";
import { promisify } from "util";
import { Server as SocketServer } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { cryptoService } from "./crypto.service";
import logger from "../utils/logger";
import { FFMPEG_PATH } from "../config/paths";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

interface MjpegStream {
  process: ChildProcess;
  cameraId: string;
  rtspUrl: string;
  subscribers: Set<string>; // socket IDs
  frameRate: number;
  lastFrame: Buffer | null;
}

export class MjpegStreamService {
  private static streams: Map<string, MjpegStream> = new Map();
  private static io: SocketServer | null = null;

  /**
   * Socket.IO 인스턴스 설정
   */
  static initialize(io: SocketServer): void {
    this.io = io;
    logger.info("[MJPEG] Service initialized with Socket.IO");

    // Socket.IO 이벤트 핸들러 등록
    io.on("connection", (socket) => {
      // 스트림 구독 (cameraId만으로 구독 - RTSP URL은 서버에서 조회)
      socket.on("subscribe:stream", async (data: { cameraId: string }) => {
        const { cameraId } = data;
        logger.info(`[MJPEG] Socket ${socket.id} subscribing to camera ${cameraId}`);

        try {
          // 카메라 정보 조회
          const camera = await prisma.camera.findUnique({
            where: { id: cameraId },
          });

          if (!camera) {
            socket.emit("stream:error", { cameraId, error: "Camera not found" });
            return;
          }

          // RTSP URL이 없으면 에러
          if (!camera.rtspMainStream) {
            socket.emit("stream:error", { cameraId, error: "RTSP URL not configured" });
            return;
          }

          // 인증 정보 복호화 후 RTSP URL에 추가
          let rtspUrlWithAuth = camera.rtspMainStream;
          if (camera.usernameEncrypted && camera.encryptionIV && camera.encryptionTag) {
            try {
              // JSON으로 암호화된 credentials 복호화
              const decrypted = cryptoService.decrypt(camera.usernameEncrypted, camera.encryptionIV, camera.encryptionTag);
              const { username, password } = JSON.parse(decrypted);
              // rtsp://192.168.0.64/... → rtsp://user:pass@192.168.0.64/...
              rtspUrlWithAuth = camera.rtspMainStream.replace(
                "rtsp://",
                `rtsp://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
              );
              logger.debug(`[MJPEG] Added auth to RTSP URL for ${cameraId}`);
            } catch (err) {
              logger.warn(`[MJPEG] Failed to decrypt credentials for ${cameraId}, using URL without auth`);
            }
          }

          await this.subscribe(cameraId, rtspUrlWithAuth, socket.id);
          socket.join(`stream:${cameraId}`);
        } catch (error: any) {
          logger.error(`[MJPEG] Subscribe error for ${cameraId}:`, error);
          socket.emit("stream:error", { cameraId, error: error.message || "Failed to subscribe" });
        }
      });

      // 스트림 구독 해제
      socket.on("unsubscribe:stream", (data: { cameraId: string }) => {
        const { cameraId } = data;
        logger.info(`[MJPEG] Socket ${socket.id} unsubscribing from camera ${cameraId}`);

        this.unsubscribe(cameraId, socket.id);
        socket.leave(`stream:${cameraId}`);
      });

      // 연결 해제 시 모든 구독 정리
      socket.on("disconnect", () => {
        this.unsubscribeAll(socket.id);
      });
    });
  }

  /**
   * 스트림 구독 (구독자가 없으면 FFmpeg 시작)
   */
  static async subscribe(cameraId: string, rtspUrl: string, socketId: string): Promise<void> {
    let stream = this.streams.get(cameraId);

    if (stream) {
      // 이미 스트림이 실행 중이면 구독자 추가
      stream.subscribers.add(socketId);
      logger.info(`[MJPEG] Added subscriber to ${cameraId}. Total: ${stream.subscribers.size}`);

      // 마지막 프레임이 있으면 즉시 전송
      // lastFrame이 없으면 사용자 연결 -> 다음 프레임까지 대기 -> 화면 표시, 약간의 지연 발생
      // 있다면, 사용자 연결 -> 즉시 마지막 프레임 전송 -> 화면 표시, 지연 없음
      if (stream.lastFrame && this.io) {
        this.io.to(socketId).emit("stream:frame", {
          cameraId,
          frame: stream.lastFrame.toString("base64"),
          timestamp: Date.now(),
        });
      }
      return;
    }

    // 새 스트림 시작
    await this.startStream(cameraId, rtspUrl, socketId);
  }

  /**
   * 스트림 구독 해제 (구독자가 0이면 FFmpeg 중지)
   */
  static unsubscribe(cameraId: string, socketId: string): void {
    const stream = this.streams.get(cameraId);
    if (!stream) return;

    stream.subscribers.delete(socketId);
    logger.info(`[MJPEG] Removed subscriber from ${cameraId}. Remaining: ${stream.subscribers.size}`);

    // 구독자가 없으면 스트림 중지
    if (stream.subscribers.size === 0) {
      this.stopStream(cameraId);
    }
  }

  /**
   * 특정 소켓의 모든 구독 해제
   */
  static unsubscribeAll(socketId: string): void {
    for (const [cameraId, stream] of this.streams) {
      if (stream.subscribers.has(socketId)) {
        this.unsubscribe(cameraId, socketId);
      }
    }
  }

  /**
   * FFmpeg MJPEG 스트림 시작
   */
  private static async startStream(cameraId: string, rtspUrl: string, initialSubscriber: string): Promise<void> {
    // 기존 프로세스 정리
    await this.killExistingProcesses(cameraId);

    const frameRate = 10; // 10 FPS

    // FFmpeg: RTSP -> MJPEG (stdout으로 출력)
    const ffmpegArgs = [
      "-rtsp_transport", "tcp", // TCP 전송 사용
      "-i", rtspUrl,            // 입력 RTSP URL
      "-f", "mjpeg",            // 출력 포맷 MJPEG
      "-q:v", "5",              // JPEG 품질 (2-31, 낮을수록 좋음)
      "-r", String(frameRate),  // 프레임 레이트
      "-s", "640x360",          // 해상도 (성능을 위해 줄임)
      "-an",                    // 오디오 제외
      "pipe:1"                  // stdout으로 출력 (stdout ? 출력을 위한 스트림으로 표준 출력 장치는 ID1, 일반적으로 현재 쉘을 실행한 콘솔이나 터미널)
    ];

    logger.info(`[MJPEG] Starting stream for camera ${cameraId}`);
    logger.debug(`[MJPEG] FFmpeg args: ${ffmpegArgs.join(" ")}`);

    const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs);

    const stream: MjpegStream = {
      process: ffmpegProcess,
      cameraId,
      rtspUrl,
      subscribers: new Set([initialSubscriber]),
      frameRate,
      lastFrame: null,
    };

    this.streams.set(cameraId, stream);

    // JPEG 프레임 파싱을 위한 버퍼
    // 필요한 이유 ? 데이터가 중간에 잘려서 옴. JPEG 경계를 찾아서 완전한 프레임만 추출해야 함.
    let buffer = Buffer.alloc(0);
    const JPEG_START = Buffer.from([0xff, 0xd8]); // JPEG 시작 마커
    const JPEG_END = Buffer.from([0xff, 0xd9]); // JPEG 종료 마커

    ffmpegProcess.stdout?.on("data", (data: Buffer) => {
      // 1. 새 데이터를 버퍼에 추가
      buffer = Buffer.concat([buffer, data]);

      // 2. 완전한 JPEG 프레임 찾기
      while (true) {
        // 2-1. JPEG 시작 마커 찾기
        const startIdx = buffer.indexOf(JPEG_START);
        if (startIdx === -1) break; // 시작 마커 없으면 종료

        // 2-2. JPEG 종료 마커 찾기
        const endIdx = buffer.indexOf(JPEG_END, startIdx);
        if (endIdx === -1) break; // 종료 마커 없으면 종료(다음 data 이벤트)

        // 2-3. 완전한 JPEG 프레임 추출
        const frame = buffer.subarray(startIdx, endIdx + 2);
        // 2-4. 버퍼에서 추출한 프레임 제거 (사용한 데이터 제거)
        buffer = buffer.subarray(endIdx + 2);

        // 프레임 저장 및 전송
        stream.lastFrame = frame;
        this.broadcastFrame(cameraId, frame);
      }

      // 버퍼가 너무 커지면 정리 (메모리 보호)
      if (buffer.length > 1024 * 1024) {
        buffer = Buffer.alloc(0);
      }
    });

    ffmpegProcess.stderr?.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("Error") || msg.includes("error")) {
        logger.error(`[MJPEG] FFmpeg error for ${cameraId}: ${msg}`);
      }
    });

    ffmpegProcess.on("error", (error) => {
      logger.error(`[MJPEG] Process error for ${cameraId}: ${error.message}`);
      this.streams.delete(cameraId);
      this.notifyError(cameraId, "Stream process error");
    });

    ffmpegProcess.on("exit", (code) => {
      logger.info(`[MJPEG] Process exited for ${cameraId} with code ${code}`);
      this.streams.delete(cameraId);

      if (code !== 0) {
        this.notifyError(cameraId, "Stream ended unexpectedly");
      }
    });
  }

  /**
   * 프레임을 모든 구독자에게 브로드캐스트
   */
  private static broadcastFrame(cameraId: string, frame: Buffer): void {
    if (!this.io) return;

    this.io.to(`stream:${cameraId}`).emit("stream:frame", {
      cameraId,
      frame: frame.toString("base64"), // Base64로 인코딩하여 전송
      timestamp: Date.now(),
    });
  }

  /**
   * 에러 알림
   */
  private static notifyError(cameraId: string, message: string): void {
    if (!this.io) return;

    this.io.to(`stream:${cameraId}`).emit("stream:error", {
      cameraId,
      error: message,
    });
  }

  /**
   * 스트림 중지
   */
  static stopStream(cameraId: string): void {
    const stream = this.streams.get(cameraId);
    if (!stream) return;

    logger.info(`[MJPEG] Stopping stream for camera ${cameraId}`);
    stream.process.kill("SIGKILL");
    this.streams.delete(cameraId);
  }

  /**
   * 모든 스트림 중지
   */
  static async stopAllStreams(): Promise<void> {
    for (const cameraId of this.streams.keys()) {
      this.stopStream(cameraId);
    }
  }

  /**
   * 기존 FFmpeg 프로세스 정리
   */
  private static async killExistingProcesses(cameraId: string): Promise<void> {
    try {
      const { stdout } = await execAsync(
        `ps aux | grep ffmpeg | grep "${cameraId}" | grep -v grep | awk '{print $2}'`
      );

      const pids = stdout.trim().split("\n").filter(Boolean);
      for (const pid of pids) {
        try {
          await execAsync(`kill -9 ${pid}`);
          logger.info(`[MJPEG] Killed existing process ${pid} for ${cameraId}`);
        } catch {
          // 이미 종료됨
        }
      }
    } catch {
      // grep 결과 없음
    }
  }

  /**
   * 활성 스트림 목록
   */
  static getActiveStreams(): Array<{ cameraId: string; subscribers: number; frameRate: number }> {
    const result: Array<{ cameraId: string; subscribers: number; frameRate: number }> = [];

    for (const [cameraId, stream] of this.streams) {
      result.push({
        cameraId,
        subscribers: stream.subscribers.size,
        frameRate: stream.frameRate,
      });
    }

    return result;
  }
}
