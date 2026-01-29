import { Router } from "express";
import { z } from "zod";
import { prisma } from "../index";
import { Request } from "express";
import logger from "../utils/logger";

const router = Router();

const siteSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  description: z.string().optional(),
  networkCIDR: z.string().optional(),
});

// List all sites (현재 사용자가 접근 가능한 사이트만)
router.get("/", async (req: Request, res) => {
  try {
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    // 현재 사용자가 접근 가능한 사이트만 조회
    const sites = await prisma.site.findMany({
      where: {
        isActive: true,
        users: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        _count: {
          select: { cameras: { where: { isActive: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(sites);
  } catch (error) {
    logger.error("List sites error:", error);
    res.status(500).json({ error: "Failed to list sites" });
  }
});

// Create new site
router.post("/", async (req: Request, res) => {
  try {
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    const data = siteSchema.parse(req.body);

    // 사이트 생성과 동시에 UserSite 관계 생성 (트랜잭션)
    const site = await prisma.site.create({
      data: {
        ...data,
        users: {
          create: {
            userId: user.id,
            canView: true,
            canEdit: true,
            canManage: true, // 생성자는 모든 권한 부여
          },
        },
      },
      include: { _count: { select: { cameras: { where: { isActive: true } } } } },
    });

    logger.info(`Site created: ${site.name} by user: ${user.email}`);
    res.status(201).json(site);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error("Create site error:", error);
    res.status(500).json({ error: "Failed to create site" });
  }
});

// Get site details
router.get("/:id", async (req: Request, res) => {
  try {
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    const { id } = req.params;

    // 사용자가 접근 권한이 있는지 확인
    const userSite = await prisma.userSite.findUnique({
      where: {
        userId_siteId: {
          userId: user.id,
          siteId: id,
        },
      },
    });

    if (!userSite) {
      return res.status(403).json({ error: "이 사이트에 접근 권한이 없습니다" });
    }

    const site = await prisma.site.findUnique({
      where: { id },
      include: {
        cameras: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            ipAddress: true,
            port: true,
            protocol: true,
            isOnline: true,
            lastSeen: true,
            macAddress: true,
            serialNumber: true,
          },
        },
        _count: { select: { cameras: { where: { isActive: true } } } },
      },
    });

    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    // isOnline을 status로 변환하여 반환
    const siteWithStatus = {
      ...site,
      cameras: site.cameras.map((camera) => ({
        ...camera,
        status: camera.isOnline ? "ONLINE" : "OFFLINE",
      })),
    };

    res.json(siteWithStatus);
  } catch (error) {
    logger.error("Get site error:", error);
    res.status(500).json({ error: "Failed to get site" });
  }
});

// Update site
router.put("/:id", async (req: Request, res) => {
  try {
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    const { id } = req.params;

    // 수정 권한 확인
    const userSite = await prisma.userSite.findUnique({
      where: {
        userId_siteId: {
          userId: user.id,
          siteId: id,
        },
      },
    });

    if (!userSite || !userSite.canEdit) {
      return res.status(403).json({ error: "이 사이트를 수정할 권한이 없습니다" });
    }

    const data = siteSchema.partial().parse(req.body);

    const site = await prisma.site.update({
      where: { id },
      data,
      include: { _count: { select: { cameras: { where: { isActive: true } } } } },
    });

    logger.info(`Site updated: ${site.name}`);
    res.json(site);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error("Update site error:", error);
    res.status(500).json({ error: "Failed to update site" });
  }
});

// Delete site (hard delete - cascades to cameras and alarms)
router.delete("/:id", async (req: Request, res) => {
  try {
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    const { id } = req.params;

    // 관리 권한 확인
    const userSite = await prisma.userSite.findUnique({
      where: {
        userId_siteId: {
          userId: user.id,
          siteId: id,
        },
      },
    });

    if (!userSite || !userSite.canManage) {
      return res.status(403).json({ error: "이 사이트를 삭제할 권한이 없습니다" });
    }

    // 사이트 삭제 시 연결된 카메라와 알람도 함께 삭제됨 (Prisma onDelete: Cascade)
    await prisma.site.delete({
      where: { id },
    });

    logger.info(`Site deleted (with cameras and alarms): ${id}`);
    res.json({ message: "Site deleted successfully" });
  } catch (error) {
    logger.error("Delete site error:", error);
    res.status(500).json({ error: "Failed to delete site" });
  }
});

// List cameras for site
router.get("/:id/cameras", async (req: Request, res) => {
  try {
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    const { id } = req.params;

    // 접근 권한 확인
    const userSite = await prisma.userSite.findUnique({
      where: {
        userId_siteId: {
          userId: user.id,
          siteId: id,
        },
      },
    });

    if (!userSite) {
      return res.status(403).json({ error: "이 사이트에 접근 권한이 없습니다" });
    }

    const cameras = await prisma.camera.findMany({
      where: { siteId: id, isActive: true },
      select: {
        id: true,
        name: true,
        ipAddress: true,
        port: true,
        protocol: true,
        manufacturer: true,
        model: true,
        isOnline: true,
        lastSeen: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(cameras);
  } catch (error) {
    logger.error("List site cameras error:", error);
    res.status(500).json({ error: "Failed to list cameras" });
  }
});

export default router;
