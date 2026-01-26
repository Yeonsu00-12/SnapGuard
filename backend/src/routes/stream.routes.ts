import { Router } from "express";
import * as path from "path";
import { prisma } from "../index";
import { Request } from "express";
import { HLSStreamService } from "../services/hls-stream.service";
import { FFmpegCaptureService } from "../services/ffmpeg-capture.service";
import { cryptoService } from "../services/crypto.service";
import logger from "../utils/logger";

/**
 * 카메라 인증 정보를 RTSP URL에 추가
 * rtsp://192.168.0.64/... → rtsp://user:pass@192.168.0.64/...
 *
 * credentials는 JSON으로 암호화되어 usernameEncrypted에 저장됨
 */
function addAuthToRtspUrl(
  rtspUrl: string,
  camera: {
    usernameEncrypted: string | null;
    encryptionIV: string | null;
    encryptionTag: string | null;
  }
): string {
  if (!camera.usernameEncrypted || !camera.encryptionIV || !camera.encryptionTag) {
    return rtspUrl;
  }

  try {
    // JSON으로 암호화된 credentials 복호화
    const decrypted = cryptoService.decrypt(camera.usernameEncrypted, camera.encryptionIV, camera.encryptionTag);
    const { username, password } = JSON.parse(decrypted);
    return rtspUrl.replace(
      "rtsp://",
      `rtsp://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
    );
  } catch {
    return rtspUrl;
  }
}

const router = Router();

/**
 * 스트리밍 정보 조회
 */
router.get("/:cameraId/info", async (req: Request, res) => {
  try {
    const { cameraId } = req.params;

    const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
    if (!camera) {
      return res.status(404).json({ error: "Camera not found" });
    }

    if (!camera.rtspMainStream) {
      return res.status(400).json({ error: "RTSP URL not configured for this camera" });
    }

    res.json({
      cameraId,
      rtspUrl: camera.rtspMainStream,
      hlsUrl: `/uploads/hls/${cameraId}/playlist.m3u8`,
    });
  } catch (error) {
    logger.error("Get stream info error:", error);
    res.status(500).json({ error: "Failed to get stream info" });
  }
});

/**
 * HLS 스트리밍 시작 (FFmpeg)
 */
router.post("/:cameraId/start", async (req: Request, res) => {
  try {
    const { cameraId } = req.params;

    const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
    if (!camera) {
      return res.status(404).json({ error: "Camera not found" });
    }

    if (!camera.rtspMainStream) {
      return res.status(400).json({ error: "RTSP URL not configured for this camera" });
    }

    logger.info(`Starting HLS stream for ${camera.name} (${camera.ipAddress})`);
    const rtspUrlWithAuth = addAuthToRtspUrl(camera.rtspMainStream, camera);
    const hlsUrl = await HLSStreamService.startStream(cameraId, rtspUrlWithAuth);

    // 카메라 상태 업데이트
    await prisma.camera.update({
      where: { id: cameraId },
      data: { isOnline: true, lastSeen: new Date() },
    });

    logger.info(`HLS stream started for camera: ${camera.name}`);
    res.json({
      success: true,
      hlsUrl,
      message: "HLS stream started. Wait a few seconds for playlist to be ready.",
    });
  } catch (error) {
    logger.error("Start stream error:", error);
    res.status(500).json({ error: "Failed to start stream" });
  }
});

/**
 * 스트리밍 중지
 */
router.post("/:cameraId/stop", async (req: Request, res) => {
  try {
    const { cameraId } = req.params;
    const stopped = await HLSStreamService.stopStream(cameraId);
    res.json({ success: stopped });
  } catch (error) {
    logger.error("Stop stream error:", error);
    res.status(500).json({ error: "Failed to stop stream" });
  }
});

/**
 * 스트림 상태 확인
 */
router.get("/:cameraId/status", async (req: Request, res) => {
  const { cameraId } = req.params;
  const status = HLSStreamService.getStreamStatus(cameraId);
  res.json(status);
});

/**
 * 모든 활성 스트림 목록
 */
router.get("/active", async (req: Request, res) => {
  const streams = HLSStreamService.getActiveStreams();
  res.json({ streams, count: streams.length });
});

/**
 * 모든 FFmpeg 프로세스 강제 종료 (긴급 정리용)
 */
router.post("/kill-all", async (req: Request, res) => {
  try {
    const killedCount = await HLSStreamService.killAllFFmpegProcesses();
    logger.warn(`Force killed ${killedCount} FFmpeg processes by user request`);
    res.json({ success: true, killedCount, message: `Killed ${killedCount} FFmpeg processes` });
  } catch (error) {
    logger.error("Kill all streams error:", error);
    res.status(500).json({ error: "Failed to kill FFmpeg processes" });
  }
});

/**
 * 스냅샷 캡처 (FFmpeg RTSP)
 */
router.get("/:cameraId/snapshot", async (req: Request, res) => {
  try {
    const { cameraId } = req.params;

    const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
    if (!camera) {
      return res.status(404).json({ error: "Camera not found" });
    }

    if (!camera.rtspMainStream) {
      return res.status(400).json({ error: "RTSP URL not configured for this camera" });
    }

    const outputFilename = `${camera.ipAddress.replace(/\./g, "_")}_${Date.now()}.jpg`;
    const rtspUrlWithAuth = addAuthToRtspUrl(camera.rtspMainStream, camera);
    const snapshotPath = await FFmpegCaptureService.captureSnapshot(
      rtspUrlWithAuth,
      outputFilename
    );
    const filename = path.basename(snapshotPath);
    logger.info(`Snapshot captured via FFmpeg: ${filename}`);

    res.json({
      success: true,
      url: `/uploads/snapshots/${filename}`,
    });
  } catch (error) {
    logger.error("Snapshot error:", error);
    res.status(500).json({ error: "Failed to capture snapshot" });
  }
});

/**
 * FFmpeg 설치 확인
 */
router.get("/ffmpeg/check", async (req: Request, res) => {
  const installed = await FFmpegCaptureService.checkFFmpegInstalled();
  res.json({ installed });
});

export default router;
