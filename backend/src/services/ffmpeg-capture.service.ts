import { spawn, exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import logger from "../utils/logger";
import { FFMPEG_PATH } from "../config/paths";

const execAsync = promisify(exec);

/**
 * ============================================================
 * FFmpeg 캡처 서비스
 * ============================================================
 *
 * RTSP 스트림에서 정적 이미지/영상 캡처
 * - 스냅샷 (단일 프레임 JPEG)
 * - 영상 클립 (짧은 MP4)
 * - 주기적 캡처 (모션 감지용)
 *
 * 사용 사례:
 * - ONVIF 스냅샷 실패 시 fallback
 * - 알람 발생 시 증거 영상 저장
 * - 모션 감지를 위한 프레임 비교
 */

export class FFmpegCaptureService {
  // 파일 저장 디렉토리
  private static snapshotDir = path.join(process.cwd(), "uploads", "snapshots");
  private static clipsDir = path.join(process.cwd(), "uploads", "clips");

  /**
   * 정적 초기화 블록
   */
  static {
    // 스냅샷 디렉토리 생성
    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true });
    }
    // 클립 디렉토리 생성
    if (!fs.existsSync(this.clipsDir)) {
      fs.mkdirSync(this.clipsDir, { recursive: true });
    }
  }

  /**
   * ============================================================
   * RTSP 스트림에서 스냅샷 캡처
   * ============================================================
   *
   * FFmpeg로 RTSP 스트림에서 단일 프레임(JPEG) 추출
   *
   * 옵션 설명:
   * -y              : 출력 파일 덮어쓰기
   * -rtsp_transport tcp : TCP 전송 (UDP보다 안정적)
   * -i              : 입력 URL
   * -frames:v 1     : 비디오 프레임 1개만 캡처
   * -q:v 2          : JPEG 품질 (2-31, 낮을수록 고품질)
   *
   * 성능:
   * - 소요 시간: 약 1-3초 (RTSP 연결 + 키프레임 대기)
   * - 파일 크기: 약 50-200KB (해상도에 따라)
   *
   * @param rtspUrl - RTSP 스트림 URL (인증 정보 포함)
   * @param outputFilename - 출력 파일명 (선택)
   * @returns 저장된 파일 전체 경로
   */
  static async captureSnapshot(
    rtspUrl: string,
    outputFilename?: string
  ): Promise<string> {
    const filename = outputFilename || `snapshot_${Date.now()}.jpg`;
    const outputPath = path.join(this.snapshotDir, filename);

    const ffmpegCommand = `${FFMPEG_PATH} -y -rtsp_transport tcp -i "${rtspUrl}" \
      -frames:v 1 -q:v 2 "${outputPath}" 2>&1`;

    try {
      // 15초 타임아웃 (RTSP 연결 실패 대비)
      await execAsync(ffmpegCommand, { timeout: 15000 });

      if (fs.existsSync(outputPath)) {
        logger.info(`[Capture] Snapshot saved: ${outputPath}`);
        return outputPath;
      } else {
        throw new Error("Snapshot file not created");
      }
    } catch (error: any) {
      logger.error(`[Capture] Snapshot error: ${error.message}`);
      throw error;
    }
  }

  /**
   * ============================================================
   * RTSP 영상 클립 캡처 (알람 발생 시)
   * ============================================================
   *
   * 알람 발생 시 전후 영상을 저장하기 위해 사용
   *
   * FFmpeg 옵션:
   * -t {duration}     : 녹화 시간 제한
   * -c:v libx264      : H.264 코덱
   * -preset ultrafast : 빠른 인코딩
   * -crf 23           : 품질 (0-51, 낮을수록 고품질, 23은 기본값)
   * -movflags +faststart : MP4 메타데이터를 파일 앞으로 이동 (웹 스트리밍 최적화)
   *
   * @param rtspUrl - RTSP 스트림 URL (인증 정보 포함)
   * @param durationSeconds - 녹화 시간 (기본 6초)
   * @param outputFilename - 출력 파일명 (선택)
   * @returns 저장된 영상 파일 경로
   */
  static async captureVideoClip(
    rtspUrl: string,
    durationSeconds: number = 6,
    outputFilename?: string
  ): Promise<string> {
    const filename = outputFilename || `clip_${Date.now()}.mp4`;
    const outputPath = path.join(this.clipsDir, filename);

    const ffmpegArgs = [
      "-y",                           // 파일 덮어쓰기
      "-rtsp_transport", "tcp",       // TCP 전송
      "-i", rtspUrl,                  // 입력
      "-t", String(durationSeconds),  // 녹화 시간
      "-c:v", "libx264",              // 비디오 코덱
      "-preset", "ultrafast",         // 빠른 인코딩
      "-crf", "23",                   // 품질
      "-c:a", "aac",                  // 오디오 코덱
      "-movflags", "+faststart",      // 웹 최적화
      outputPath
    ];

    logger.info(`[Capture] Recording ${durationSeconds}s video clip...`);

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs);

      let stderr = "";
      ffmpeg.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("error", (error) => {
        logger.error(`[Capture] Video clip error: ${error.message}`);
        reject(error);
      });

      ffmpeg.on("close", (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          logger.info(`[Capture] Video clip saved: ${outputPath}`);
          resolve(outputPath);
        } else {
          logger.error(`[Capture] Video clip failed (code ${code}): ${stderr}`);
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      // 타임아웃 (녹화 시간 + 10초 여유)
      setTimeout(() => {
        if (!ffmpeg.killed) {
          ffmpeg.kill("SIGKILL");
          reject(new Error("Video capture timeout"));
        }
      }, (durationSeconds + 10) * 1000);
    });
  }

  /**
   * ============================================================
   * 주기적 스냅샷 캡처 (모션 감지용)
   * ============================================================
   *
   * 일정 간격으로 스냅샷을 캡처하여 모션 감지에 사용
   * 프레임 간 차이 분석으로 움직임 감지 가능
   *
   * @param cameraId - 카메라 식별자
   * @param rtspUrl - RTSP 스트림 URL
   * @param intervalMs - 캡처 간격 (기본 5000ms = 5초)
   * @param callback - 캡처 완료 시 호출될 콜백
   * @returns setInterval ID (clearInterval로 중지)
   */
  static startPeriodicCapture(
    cameraId: string,
    rtspUrl: string,
    intervalMs: number = 5000,
    callback?: (snapshotPath: string) => void
  ): NodeJS.Timeout {
    const intervalId = setInterval(async () => {
      try {
        const filename = `${cameraId}_${Date.now()}.jpg`;
        const snapshotPath = await this.captureSnapshot(rtspUrl, filename);

        if (callback) {
          callback(snapshotPath);
        }
      } catch (error) {
        logger.error(`[Capture] Periodic capture failed for ${cameraId}`);
      }
    }, intervalMs);

    logger.info(`[Capture] Started periodic capture for ${cameraId} every ${intervalMs}ms`);
    return intervalId;
  }

  /**
   * FFmpeg 설치 확인
   */
  static async checkFFmpegInstalled(): Promise<boolean> {
    try {
      await execAsync(`${FFMPEG_PATH} -version`);
      return true;
    } catch {
      return false;
    }
  }
}
