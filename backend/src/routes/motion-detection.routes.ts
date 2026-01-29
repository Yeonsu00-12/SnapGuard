import { Router } from "express";
import { Request } from "express";
import { prisma } from "../index";
import { HikvisionDetectionService } from "../services/hikvision-detection.service";
import { DahuaDetectionService } from "../services/dahua-detection.service";
import { cryptoService } from "../services/crypto.service";
import logger from "../utils/logger";

const router = Router();

/**
 * ============================================================
 * 모션 감지 설정 API
 * ============================================================
 *
 * 인증: 카메라 계정 정보 필수 (HTTP Digest Auth)
 * - Hikvision, Dahua 모두 카메라 자체 인증 필요
 * - username: 카메라 관리자 계정 (기본값: admin)
 * - password: 카메라 비밀번호 (필수)
 *
 * 제조사별 API 사용:
 * - Hikvision: ISAPI (XML 기반, 15x22 그리드)
 * - Dahua: CGI (Query String 기반, 폴리곤 좌표)
 *
 * 프론트엔드는 15x22 그리드(boolean[][])로 통일하여 전송
 * 백엔드에서 제조사별 형식으로 변환
 */

/**
 * 모션 감지 설정 조회
 *
 * GET /api/motion-detection/:cameraId?username=xxx&password=xxx
 *
 * @query username - 카메라 관리자 계정 (기본값: admin)
 * @query password - 카메라 비밀번호 (필수)
 */
router.get("/:cameraId", async (req: Request, res) => {
  try {
    const { cameraId } = req.params;
    let { username, password } = req.query as { username?: string; password?: string };

    const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
    if (!camera) {
      return res.status(404).json({ error: "Camera not found" });
    }

    // query에 인증 정보가 없으면 카메라 DB에서 가져오기
    // usernameEncrypted에 { username, password } JSON이 암호화되어 저장됨
    if (!username || !password) {
      if (camera.usernameEncrypted && camera.encryptionIV && camera.encryptionTag) {
        try {
          const decrypted = cryptoService.decrypt(
            camera.usernameEncrypted,
            camera.encryptionIV,
            camera.encryptionTag
          );
          const creds = JSON.parse(decrypted);
          username = username || creds.username || "admin";
          password = password || creds.password;
        } catch (e) {
          logger.warn(`Failed to decrypt credentials for camera ${cameraId}`);
          return res.status(400).json({ error: "Camera credentials not available" });
        }
      } else {
        return res.status(400).json({ error: "Camera credentials not configured" });
      }
    }

    // 인증 정보 최종 확인
    if (!username || !password) {
      return res.status(400).json({ error: "Camera credentials missing" });
    }

    // 타입 확정 (TypeScript용)
    const authUsername: string = username;
    const authPassword: string = password;

    let result: {
      enabled: boolean;
      sensitivity: number;
      grid: boolean[][];
    } | null = null;

    const manufacturer = camera.manufacturer?.toLowerCase() || "";

    // 제조사별 API 호출
    if (manufacturer.includes("hikvision") || manufacturer.includes("hik")) {
      // Hikvision ISAPI
      const config = await HikvisionDetectionService.getMotionDetection(
        camera.ipAddress,
        authUsername,
        authPassword
      );

      if (config) {
        result = {
          enabled: config.enabled,
          sensitivity: config.sensitivity,
          grid: config.gridMap
            ? HikvisionDetectionService.gridMapToGrid(config.gridMap)
            : createEmptyGrid(),
        };
      }
    } else if (manufacturer.includes("dahua") || manufacturer.includes("general")) {
      // Dahua CGI
      const config = await DahuaDetectionService.getMotionDetection(
        camera.ipAddress,
        authUsername,
        authPassword
      );

      if (config) {
        result = {
          enabled: config.enabled,
          sensitivity: config.sensitivity,
          grid: config.regions.length > 0
            ? DahuaDetectionService.regionsToGrid(config.regions)
            : createEmptyGrid(),
        };
      }
    } else {
      // 지원하지 않는 제조사
      return res.json({
        cameraId,
        manufacturer: camera.manufacturer,
        supported: false,
        reason: `Unsupported manufacturer: ${camera.manufacturer || "Unknown"}`,
        supportedManufacturers: ["Hikvision", "Dahua"],
      });
    }

    if (!result) {
      return res.status(500).json({ error: "Failed to get motion detection config" });
    }

    res.json({
      cameraId,
      manufacturer: camera.manufacturer,
      supported: true,
      ...result,
    });
  } catch (error) {
    logger.error("Get motion detection error:", error);
    res.status(500).json({ error: "Failed to get motion detection config" });
  }
});

/**
 * 모션 감지 설정 변경
 *
 * PUT /api/motion-detection/:cameraId
 *
 * @body {
 *   username: string,       // 카메라 관리자 계정 (기본값: admin)
 *   password: string,       // 카메라 비밀번호 (필수)
 *   enabled: boolean,       // 모션 감지 활성화 여부
 *   sensitivity: number,    // 감도 (0-100, 프론트엔드 기준)
 *   grid: boolean[][]       // 15x22 감지 영역 그리드
 * }
 */
router.put("/:cameraId", async (req: Request, res) => {
  try {
    const { cameraId } = req.params;
    const { enabled = true, sensitivity = 50, grid, username = "admin", password = "" } = req.body;

    if (!grid || !Array.isArray(grid)) {
      return res.status(400).json({ error: "grid (boolean[][]) is required" });
    }

    const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
    if (!camera) {
      return res.status(404).json({ error: "Camera not found" });
    }

    let result: { success: boolean; message: string };
    const manufacturer = camera.manufacturer?.toLowerCase() || "";

    // 제조사별 API 호출
    if (manufacturer.includes("hikvision") || manufacturer.includes("hik")) {
      // Hikvision: 그리드를 gridMap(hex)으로 변환
      const gridMap = HikvisionDetectionService.gridToGridMap(grid);

      result = await HikvisionDetectionService.setMotionDetection(
        camera.ipAddress,
        username,
        password,
        enabled,
        sensitivity,
        gridMap
      );
    } else if (manufacturer.includes("dahua") || manufacturer.includes("general")) {
      // Dahua: 그리드를 Region 좌표로 변환
      const regions = DahuaDetectionService.gridToRegions(grid);

      // Dahua sensitivity는 0-10 범위, 프론트엔드는 0-100
      const dahuaSensitivity = Math.round(sensitivity / 10);

      result = await DahuaDetectionService.setMotionDetection(
        camera.ipAddress,
        username,
        password,
        enabled,
        dahuaSensitivity,
        10, // threshold 기본값
        regions.length > 0 ? regions : ["0,0,8191,0,8191,8191,0,8191"]
      );
    } else {
      return res.status(400).json({
        error: `Unsupported manufacturer: ${camera.manufacturer}`,
        supportedManufacturers: ["Hikvision", "Dahua"],
      });
    }

    if (result.success) {
      logger.info(`Motion detection updated for camera ${cameraId}`);
      res.json({ success: true, message: result.message });
    } else {
      res.status(500).json({ success: false, error: result.message });
    }
  } catch (error) {
    logger.error("Set motion detection error:", error);
    res.status(500).json({ error: "Failed to set motion detection config" });
  }
});

/**
 * 빈 그리드 생성 (15x22)
 */
function createEmptyGrid(): boolean[][] {
  return Array(15).fill(null).map(() => Array(22).fill(false));
}

export default router;
