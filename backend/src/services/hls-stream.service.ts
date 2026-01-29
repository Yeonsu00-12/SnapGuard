import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import logger from "../utils/logger";
import { FFMPEG_PATH } from "../config/paths";

/**
 * ============================================================
 * HLS 스트리밍 서비스 (간소화 버전)
 * ============================================================
 *
 * RTSP → FFmpeg → HLS(.m3u8 + .ts) → Express Static → Frontend(hls.js)
 *
 * ## 동작 원리
 *
 * 1. FFmpeg가 RTSP 스트림을 받아서 H.264로 인코딩
 * 2. 1초마다 .ts 세그먼트 파일 생성 (segment_000.ts, segment_001.ts, ...)
 * 3. playlist.m3u8에 최근 3개 세그먼트 목록 기록
 * 4. Express가 uploads/hls/ 폴더를 정적 파일로 서빙
 * 5. 프론트엔드의 hls.js가 m3u8을 주기적으로 요청하며 새 세그먼트 다운로드
 *
 * ## 파일 구조
 *
 * uploads/hls/{cameraId}/
 * ├── playlist.m3u8      # 세그먼트 목록 (브라우저가 폴링)
 * ├── segment_000.ts     # 1초 분량 비디오
 * ├── segment_001.ts
 * └── segment_002.ts     # hls_list_size=3 → 최근 3개만 유지
 */

interface StreamProcess {
  process: ChildProcess;
  cameraId: string;
  hlsPath: string;
  startedAt: Date;
}

export class HLSStreamService {
  private static streams: Map<string, StreamProcess> = new Map();
  private static startingStreams: Set<string> = new Set(); // 시작 중인 스트림 (race condition 방지)
  private static hlsDir = path.join(process.cwd(), "uploads", "hls");

  static {
    if (!fs.existsSync(this.hlsDir)) {
      fs.mkdirSync(this.hlsDir, { recursive: true });
    }
  }

  /**
   * HLS 스트리밍 시작
   *
   * @param cameraId - 카메라 ID (폴더명으로 사용)
   * @param rtspUrl - RTSP 스트림 URL (인증 정보 포함)
   * @returns HLS 플레이리스트 URL
   */
  static async startStream(cameraId: string, rtspUrl: string): Promise<string> {
    // 이미 시작 중이면 기존 URL 반환 (race condition 방지)
    if (this.startingStreams.has(cameraId)) {
      logger.info(`[HLS] Stream already starting for ${cameraId}, skipping duplicate request`);
      return `/uploads/hls/${cameraId}/playlist.m3u8`;
    }

    // 이미 실행 중이면 기존 URL 반환
    if (this.streams.has(cameraId)) {
      logger.info(`[HLS] Stream already running for ${cameraId}, returning existing URL`);
      return `/uploads/hls/${cameraId}/playlist.m3u8`;
    }

    // 시작 중 표시
    this.startingStreams.add(cameraId);

    // HLS 디렉토리 초기화 (기존 파일 삭제 후 새로 생성)
    const hlsPath = path.join(this.hlsDir, cameraId);
    if (fs.existsSync(hlsPath)) {
      fs.rmSync(hlsPath, { recursive: true, force: true });
    }
    fs.mkdirSync(hlsPath, { recursive: true });

    const playlistPath = path.join(hlsPath, "playlist.m3u8");

    // FFmpeg 실행
    const ffmpegArgs = [
      // 입력
      "-rtsp_transport", "tcp",
      "-fflags", "nobuffer+genpts",
      "-flags", "low_delay",
      "-i", rtspUrl,

      // 비디오 (H.264, 저지연)
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "zerolatency",
      "-g", "15",
      "-sc_threshold", "0",

      // 오디오 제외 (일부 카메라는 오디오 없음)
      "-an",

      // HLS 출력
      "-f", "hls",
      "-hls_time", "1",
      "-hls_list_size", "3",
      "-hls_flags", "delete_segments+split_by_time+omit_endlist",
      "-hls_segment_filename", path.join(hlsPath, "segment_%03d.ts"),
      playlistPath
    ];

    logger.info(`[HLS] Starting stream for ${cameraId}`);
    logger.info(`[HLS] RTSP URL: ${rtspUrl.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`); // 비밀번호 마스킹

    const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs);

    ffmpegProcess.stderr?.on("data", (data) => {
      const msg = data.toString().trim();
      // 에러나 경고는 info 레벨로 출력
      if (msg.includes("Error") || msg.includes("error") || msg.includes("warning")) {
        logger.info(`[HLS] FFmpeg [${cameraId}]: ${msg}`);
      } else {
        logger.debug(`[HLS] FFmpeg [${cameraId}]: ${msg}`);
      }
    });

    ffmpegProcess.on("error", (error) => {
      logger.error(`[HLS] FFmpeg error [${cameraId}]: ${error.message}`);
      this.streams.delete(cameraId);
      this.startingStreams.delete(cameraId);
    });

    ffmpegProcess.on("exit", (code, signal) => {
      if (code !== 0) {
        logger.error(`[HLS] FFmpeg exited abnormally [${cameraId}] code=${code} signal=${signal}`);
      } else {
        logger.info(`[HLS] FFmpeg exited [${cameraId}] code=${code}`);
      }
      this.streams.delete(cameraId);
      this.startingStreams.delete(cameraId);
    });

    this.streams.set(cameraId, {
      process: ffmpegProcess,
      cameraId,
      hlsPath,
      startedAt: new Date(),
    });

    // 시작 완료 표시
    this.startingStreams.delete(cameraId);

    return `/uploads/hls/${cameraId}/playlist.m3u8`;
  }

  /**
   * 스트리밍 중지
   */
  static async stopStream(cameraId: string): Promise<boolean> {
    // 시작 중 플래그도 정리
    this.startingStreams.delete(cameraId);

    const stream = this.streams.get(cameraId);
    if (!stream) {
      return false;
    }

    logger.info(`[HLS] Stopping stream for ${cameraId}`);
    stream.process.kill("SIGKILL");
    this.streams.delete(cameraId);

    // HLS 파일 정리
    const hlsPath = path.join(this.hlsDir, cameraId);
    if (fs.existsSync(hlsPath)) {
      fs.rmSync(hlsPath, { recursive: true, force: true });
    }

    return true;
  }

  /**
   * 모든 스트림 중지
   */
  static async stopAllStreams(): Promise<void> {
    for (const cameraId of this.streams.keys()) {
      await this.stopStream(cameraId);
    }
  }

  /**
   * 모든 FFmpeg 프로세스 강제 종료
   */
  static async killAllFFmpegProcesses(): Promise<number> {
    let count = 0;
    for (const [cameraId, stream] of this.streams) {
      stream.process.kill("SIGKILL");
      count++;
    }
    this.streams.clear();
    return count;
  }

  /**
   * 스트림 상태 확인
   */
  static getStreamStatus(cameraId: string): { active: boolean; hlsUrl?: string; startedAt?: Date } {
    const stream = this.streams.get(cameraId);
    if (!stream) {
      return { active: false };
    }
    return {
      active: true,
      hlsUrl: `/uploads/hls/${cameraId}/playlist.m3u8`,
      startedAt: stream.startedAt,
    };
  }

  /**
   * 활성 스트림 목록
   */
  static getActiveStreams(): Array<{ cameraId: string; hlsUrl: string; startedAt: Date }> {
    return Array.from(this.streams.values()).map((s) => ({
      cameraId: s.cameraId,
      hlsUrl: `/uploads/hls/${s.cameraId}/playlist.m3u8`,
      startedAt: s.startedAt,
    }));
  }
}
