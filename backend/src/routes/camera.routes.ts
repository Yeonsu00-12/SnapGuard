import { Router } from "express";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "../index";
import { Request } from "express";
import { OnvifService } from "../services/onvif.service";
import { cryptoService } from "../services/crypto.service";
import logger from "../utils/logger";

// IP 주소로 가장 최근 스냅샷 찾기
function getLatestSnapshotUrl(ipAddress: string): string | null {
  const snapshotDir = path.join(process.cwd(), "uploads", "snapshots");
  const prefix = ipAddress.replace(/\./g, "_");

  try {
    const files = fs
      .readdirSync(snapshotDir)
      .filter((f) => f.startsWith(prefix) && f.endsWith(".jpg"))
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(snapshotDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 0) {
      return `/uploads/snapshots/${files[0].name}`;
    }
  } catch {
    // 폴더가 없거나 에러
  }
  return null;
}

const router = Router();

const cameraSchema = z.object({
  siteId: z.string(),
  name: z.string().min(1),
  ipAddress: z.string().ip(),
  port: z.number().int().min(1).max(65535).default(80),
  username: z.string(),
  password: z.string(),
  rtspMainStream: z.string().optional(),
  rtspSubStream: z.string().optional(),
  macAddress: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
});

// List all cameras (현재 사용자가 접근 가능한 사이트의 카메라만)
router.get("/", async (req: Request, res) => {
  try {
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    // 사용자가 접근 가능한 사이트 ID 목록 조회
    const userSites = await prisma.userSite.findMany({
      where: { userId: user.id },
      select: { siteId: true },
    });
    const accessibleSiteIds = userSites.map((us) => us.siteId);

    const cameras = await prisma.camera.findMany({
      where: {
        isActive: true,
        siteId: { in: accessibleSiteIds },
      },
      select: {
        id: true,
        siteId: true,
        name: true,
        ipAddress: true,
        port: true,
        protocol: true,
        manufacturer: true,
        model: true,
        macAddress: true,
        isOnline: true,
        lastSeen: true,
        site: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 각 카메라에 snapshotUrl 추가
    const camerasWithSnapshots = cameras.map((camera) => ({
      ...camera,
      snapshotUrl: getLatestSnapshotUrl(camera.ipAddress),
    }));

    res.json(camerasWithSnapshots);
  } catch (error) {
    logger.error("List cameras error:", error);
    res.status(500).json({ error: "Failed to list cameras" });
  }
});

// Add camera (ONVIF 전용)
router.post("/", async (req: Request, res) => {
  try {
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    const data = cameraSchema.parse(req.body);

    // 사이트에 카메라 추가 권한 확인
    const userSite = await prisma.userSite.findUnique({
      where: {
        userId_siteId: {
          userId: user.id,
          siteId: data.siteId,
        },
      },
    });

    if (!userSite || !userSite.canEdit) {
      return res.status(403).json({ error: "이 사이트에 카메라를 추가할 권한이 없습니다" });
    }

    // ONVIF로 RTSP URL 자동 획득
    let rtspMainStream = data.rtspMainStream;
    let profileToken: string | undefined;

    if (!rtspMainStream) {
      logger.info(`Fetching RTSP URL via ONVIF: ${data.ipAddress}`);
      const streamInfo = await OnvifService.getStreamUrl(
        data.ipAddress,
        data.port || 80,
        data.username,
        data.password
      );

      if (streamInfo) {
        rtspMainStream = streamInfo.rtspUrl;
        profileToken = streamInfo.profileToken;
        logger.info(`RTSP URL obtained: ${rtspMainStream}`);
      } else {
        logger.warn(`Failed to get RTSP URL for ${data.ipAddress}`);
      }
    }

    // 인증 정보 암호화 (username과 password를 JSON으로 합쳐서 하나의 IV/tag로 암호화)
    const credentials = JSON.stringify({ username: data.username, password: data.password });
    const encrypted = cryptoService.encrypt(credentials);

    const camera = await prisma.camera.upsert({
      where: { ipAddress: data.ipAddress },
      update: {
        siteId: data.siteId,
        name: data.name,
        port: data.port,
        protocol: "ONVIF",
        rtspMainStream,
        rtspSubStream: data.rtspSubStream,
        profileToken,
        macAddress: data.macAddress,
        model: data.model,
        manufacturer: data.manufacturer,
        // 인증 정보 저장 (usernameEncrypted에 전체 JSON 저장)
        usernameEncrypted: encrypted.encrypted,
        passwordEncrypted: null, // 사용 안 함 (JSON에 포함)
        encryptionIV: encrypted.iv,
        encryptionTag: encrypted.tag,
        isActive: true,
      },
      create: {
        siteId: data.siteId,
        name: data.name,
        ipAddress: data.ipAddress,
        port: data.port,
        protocol: "ONVIF",
        rtspMainStream,
        rtspSubStream: data.rtspSubStream,
        profileToken,
        macAddress: data.macAddress,
        model: data.model,
        manufacturer: data.manufacturer,
        // 인증 정보 저장 (usernameEncrypted에 전체 JSON 저장)
        usernameEncrypted: encrypted.encrypted,
        passwordEncrypted: null, // 사용 안 함 (JSON에 포함)
        encryptionIV: encrypted.iv,
        encryptionTag: encrypted.tag,
      },
      select: {
        id: true,
        siteId: true,
        name: true,
        ipAddress: true,
        port: true,
        protocol: true,
        isOnline: true,
        rtspMainStream: true,
      },
    });

    logger.info(`Camera added/updated: ${data.name} at ${data.ipAddress}`);
    res.status(201).json(camera);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error("Add camera error:", error);
    res.status(500).json({ error: "Failed to add camera" });
  }
});

// Get camera details
router.get("/:id", async (req: Request, res) => {
  try {
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    const { id } = req.params;

    const camera = await prisma.camera.findUnique({
      where: { id },
      select: {
        id: true,
        siteId: true,
        name: true,
        ipAddress: true,
        port: true,
        protocol: true,
        manufacturer: true,
        model: true,
        rtspMainStream: true,
        rtspSubStream: true,
        profileToken: true,
        isOnline: true,
        lastSeen: true,
        isActive: true,
        createdAt: true,
        site: { select: { id: true, name: true } },
      },
    });

    if (!camera) {
      return res.status(404).json({ error: "Camera not found" });
    }

    // 카메라가 속한 사이트에 대한 접근 권한 확인
    if (camera.siteId) {
      const userSite = await prisma.userSite.findUnique({
        where: {
          userId_siteId: {
            userId: user.id,
            siteId: camera.siteId,
          },
        },
      });

      if (!userSite) {
        return res.status(403).json({ error: "이 카메라에 접근 권한이 없습니다" });
      }
    }

    res.json(camera);
  } catch (error) {
    logger.error("Get camera error:", error);
    res.status(500).json({ error: "Failed to get camera" });
  }
});

// Update camera
router.put("/:id", async (req: Request, res) => {
  try {
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    const { id } = req.params;

    // 기존 카메라 조회
    const existingCamera = await prisma.camera.findUnique({
      where: { id },
      select: { siteId: true },
    });

    if (!existingCamera) {
      return res.status(404).json({ error: "Camera not found" });
    }

    // 수정 권한 확인
    if (existingCamera.siteId) {
      const userSite = await prisma.userSite.findUnique({
        where: {
          userId_siteId: {
            userId: user.id,
            siteId: existingCamera.siteId,
          },
        },
      });

      if (!userSite || !userSite.canEdit) {
        return res.status(403).json({ error: "이 카메라를 수정할 권한이 없습니다" });
      }
    }

    const data = cameraSchema.partial().parse(req.body);

    const camera = await prisma.camera.update({
      where: { id },
      data,
      select: {
        id: true,
        siteId: true,
        name: true,
        ipAddress: true,
        port: true,
        protocol: true,
        isOnline: true,
      },
    });

    logger.info(`Camera updated: ${camera.name}`);
    res.json(camera);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error("Update camera error:", error);
    res.status(500).json({ error: "Failed to update camera" });
  }
});

// Delete camera
router.delete("/:id", async (req: Request, res) => {
  try {
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    const { id } = req.params;

    // 기존 카메라 조회
    const existingCamera = await prisma.camera.findUnique({
      where: { id },
      select: { siteId: true },
    });

    if (!existingCamera) {
      return res.status(404).json({ error: "Camera not found" });
    }

    // 삭제 권한 확인
    if (existingCamera.siteId) {
      const userSite = await prisma.userSite.findUnique({
        where: {
          userId_siteId: {
            userId: user.id,
            siteId: existingCamera.siteId,
          },
        },
      });

      if (!userSite || !userSite.canManage) {
        return res.status(403).json({ error: "이 카메라를 삭제할 권한이 없습니다" });
      }
    }

    await prisma.camera.delete({
      where: { id },
    });

    logger.info(`Camera deleted: ${id}`);
    res.json({ message: "Camera deleted successfully" });
  } catch (error) {
    logger.error("Delete camera error:", error);
    res.status(500).json({ error: "Failed to delete camera" });
  }
});

export default router;
