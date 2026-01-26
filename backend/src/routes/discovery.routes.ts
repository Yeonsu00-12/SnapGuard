import { Router } from "express";
import * as fs from "fs";
import * as path from "path";
import DigestFetch from "digest-fetch";
import { Request } from "express";
import { CameraDiscoveryService } from "../services/camera-discovery.service";
import { OnvifService } from "../services/onvif.service";
import { FFmpegCaptureService } from "../services/ffmpeg-capture.service";
import logger from "../utils/logger";

/**
 * ============================================================
 * JPEG 이미지 유효성 검사
 * ============================================================
 *
 * JPEG 파일 구조:
 * - 모든 JPEG은 "매직 넘버" FF D8 (Start Of Image)로 시작
 * - 정상적인 이미지는 최소 수 KB 이상
 *
 * 왜 필요한가?
 * - 일부 카메라(예: Hanwha/Samsung)의 ONVIF 구현에 버그가 있음
 * - 잘못된 스냅샷 URL을 반환하여 HTTP 200 OK지만 실제 내용은 에러 메시지
 * - 예: "Error Code: 604 - Invalid Input Value(s)" (60 bytes)
 *
 * @param buffer - 다운로드된 파일의 Buffer
 * @returns true면 유효한 JPEG, false면 에러 응답이거나 손상된 파일
 */
function isValidJpeg(buffer: Buffer): boolean {
  // 최소 크기 검사 (1KB 미만이면 이미지가 아님)
  if (buffer.length < 1000) {
    return false;
  }

  // JPEG 매직 넘버 검사 (FF D8 = JPEG Start Of Image)
  // 모든 JPEG 파일은 반드시 0xFF 0xD8로 시작함
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return false;
  }

  return true;
}

/**
 * ONVIF Snapshot URL에서 이미지 다운로드 (Digest 인증)
 *
 * @param snapshotUri - ONVIF에서 받은 스냅샷 URL
 * @param username - 카메라 인증 계정
 * @param password - 카메라 인증 비밀번호
 * @param ipAddress - 파일명 생성용 IP 주소
 * @returns 저장된 파일의 웹 경로 (예: /uploads/snapshots/xxx.jpg)
 */
async function downloadOnvifSnapshot(
  snapshotUri: string,
  username: string,
  password: string,
  ipAddress: string
): Promise<string | null> {
  try {
    // ============================================================
    // Step 1: Digest 인증으로 스냅샷 다운로드
    // ============================================================
    // ONVIF 스냅샷 URL은 대부분 HTTP Digest 인증이 필요
    // digest-fetch 라이브러리가 자동으로 WWW-Authenticate 헤더를 파싱하여 인증 처리
    const client = new DigestFetch(username, password);

    // 5초 타임아웃 설정 (AbortController 사용)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await client.fetch(snapshotUri, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn(`[Snapshot] HTTP ${response.status} from ${snapshotUri}`);
      return null;
    }

    // ============================================================
    // Step 2: 응답을 Buffer로 변환
    // ============================================================
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ============================================================
    // Step 3: JPEG 유효성 검사 (핵심!)
    // ============================================================
    // 일부 카메라(예: Hanwha)는 ONVIF 구현 버그로 인해
    // HTTP 200 OK를 반환하지만 실제 내용은 에러 메시지임
    // 예: "Error Code: 604 - Invalid Input Value(s)" (60 bytes)
    if (!isValidJpeg(buffer)) {
      // 에러 내용을 로그에 출력 (디버깅용)
      const content = buffer.toString("utf8").substring(0, 100);
      logger.warn(`[Snapshot] Invalid JPEG from ONVIF (${buffer.length} bytes): ${content}`);
      return null; // null 반환 → 호출자가 FFmpeg fallback 처리
    }

    // ============================================================
    // Step 4: 유효한 JPEG만 파일로 저장
    // ============================================================
    const outputDir = path.join(process.cwd(), "uploads", "snapshots");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `${ipAddress.replace(/\./g, "_")}_${Date.now()}.jpg`;
    const outputPath = path.join(outputDir, filename);
    fs.writeFileSync(outputPath, buffer);

    logger.info(`[Snapshot] ONVIF snapshot saved: ${filename} (${buffer.length} bytes)`);
    return `/uploads/snapshots/${filename}`;
  } catch (err) {
    logger.error(`[Snapshot] Download failed: ${err}`);
    return null;
  }
}

const router = Router();

/**
 * 카메라 발견 (WS-Discovery)
 */
router.post("/scan", async (req: Request, res) => {
  try {
    const { timeout = 5000 } = req.body;

    logger.info(`[Discovery] Starting WS-Discovery (timeout=${timeout}ms)`);

    const devices = await CameraDiscoveryService.discover(timeout);

    if (devices.length === 0) {
      return res.json({ cameras: [], count: 0, message: "No cameras found" });
    }

    const cameras = devices.map((device) => ({
      ipAddress: device.ip,
      name: device.model ? `${device.model} (${device.ip})` : `Camera ${device.ip}`,
      brand: device.brand || "Unknown",
      model: device.model || null,
      macAddress: device.mac || null,
      port: device.port || 80,
    }));

    logger.info(`Discovery complete. Found ${cameras.length} cameras`);

    res.json({
      cameras,
      count: cameras.length,
      message: `Found ${cameras.length} cameras`,
    });
  } catch (error) {
    logger.error("Discovery error:", error);
    res.status(500).json({ error: "Camera discovery failed" });
  }
});

/**
 * ============================================================
 * 카메라 연결 테스트 (ONVIF 전용)
 * ============================================================
 *
 * 요청: POST /api/discovery/connect
 * body: { ipAddress, port, username, password }
 *
 * 응답:
 * - success: 연결 성공 여부
 * - rtspUrl: 실시간 스트리밍 URL
 * - snapshotUrl: 스냅샷 이미지 경로
 * - profileToken: ONVIF 프로파일 토큰
 *
 * 동작 흐름:
 * 1. ONVIF로 카메라 연결 → RTSP URL 획득
 * 2. 스냅샷 획득 (ONVIF → FFmpeg fallback)
 */
router.post("/connect", async (req: Request, res) => {
  try {
    const { ipAddress, port = 80, username, password } = req.body;

    // 필수 파라미터 검증
    if (!ipAddress || !username || !password) {
      return res.status(400).json({ error: "ipAddress, username, password are required" });
    }

    let snapshotUrl: string | null = null;
    let rtspUrl: string | null = null;
    let profileToken: string | undefined;

    // ============================================================
    // Step 1: ONVIF 연결 → RTSP URL 획득
    // ============================================================
    logger.info(`[Connect] Connecting to ${ipAddress} via ONVIF`);

    const streamInfo = await OnvifService.getStreamUrl(ipAddress, port, username, password);

    if (!streamInfo?.rtspUrl) {
      return res.status(400).json({
        success: false,
        error: "ONVIF 연결 실패. 인증 정보와 카메라 호환성을 확인하세요.",
      });
    }

    rtspUrl = streamInfo.rtspUrl;
    profileToken = streamInfo.profileToken;

    // ============================================================
    // Step 2: 스냅샷 획득 (ONVIF → FFmpeg fallback)
    // ============================================================
    //
    // 방법 1: ONVIF Snapshot URL (빠름, ~0.5초)
    //   - 카메라가 제공하는 HTTP URL로 직접 이미지 다운로드
    //   - 일부 카메라(Hanwha 등)는 ONVIF 구현 버그로 실패할 수 있음
    //
    // 방법 2: FFmpeg RTSP 캡처 (느림, ~3-5초)
    //   - RTSP 스트림에서 첫 프레임을 캡처
    //   - 모든 카메라에서 안정적으로 동작
    //
    try {
      // Step 2-1: ONVIF 스냅샷 시도
      const onvifSnapshotUri = await OnvifService.getSnapshotUrl(ipAddress, port, username, password);
      if (onvifSnapshotUri) {
        snapshotUrl = await downloadOnvifSnapshot(onvifSnapshotUri, username, password, ipAddress);
      }

      // Step 2-2: ONVIF 실패 시 FFmpeg fallback
      if (!snapshotUrl) {
        logger.info(`[Snapshot] ONVIF failed, falling back to FFmpeg RTSP capture for ${ipAddress}`);

        // RTSP URL에 인증 정보 추가
        // 원본: rtsp://192.168.0.60:554/path
        // 변환: rtsp://username:password@192.168.0.60:554/path
        const rtspUrlWithAuth = rtspUrl.replace(
          "rtsp://",
          `rtsp://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
        );

        const filename = `${ipAddress.replace(/\./g, "_")}_${Date.now()}.jpg`;
        await FFmpegCaptureService.captureSnapshot(rtspUrlWithAuth, filename);
        snapshotUrl = `/uploads/snapshots/${filename}`;
        logger.info(`[Snapshot] FFmpeg fallback successful: ${filename}`);
      }
    } catch (err) {
      logger.warn(`[Snapshot] All snapshot methods failed: ${err}`);
      // 스냅샷 실패해도 연결은 성공으로 처리 (RTSP URL은 있으니까)
    }

    logger.info(`[Connect] Success: ${ipAddress} (RTSP: ${rtspUrl})`);

    res.json({
      success: true,
      ipAddress,
      protocol: "ONVIF",
      snapshotUrl,
      rtspUrl,
      profileToken,
    });
  } catch (error) {
    logger.error("Camera connect error:", error);
    res.status(500).json({ error: "Camera connection failed" });
  }
});

export default router;
