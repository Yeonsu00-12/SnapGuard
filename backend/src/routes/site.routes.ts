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

// List all sites
router.get("/", async (req: Request, res) => {
  try {
    // 인증 제거 - 모든 사이트 반환
    const sites = await prisma.site.findMany({
      where: { isActive: true },
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
    const data = siteSchema.parse(req.body);

    const site = await prisma.site.create({
      data,
      include: { _count: { select: { cameras: { where: { isActive: true } } } } },
    });

    logger.info(`Site created: ${site.name}`);
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
    const { id } = req.params;
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
    const { id } = req.params;
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
    const { id } = req.params;

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
    const { id } = req.params;

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
