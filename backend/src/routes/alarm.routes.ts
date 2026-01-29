import { Router } from "express";
import { prisma } from "../index";
import logger from "../utils/logger";
import path from "path";
import fs from "fs";

const router = Router();

// 알람 목록 조회
router.get("/", async (req, res) => {
  try {
    const {
      status,
      severity,
      cameraId,
      siteId,
      startDate,
      endDate,
      limit = "50",
      offset = "0",
    } = req.query;

    const where: any = {};

    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (cameraId) where.cameraId = cameraId;
    if (siteId) {
      where.camera = { siteId };
    }
    if (startDate || endDate) {
      where.detectionTime = {};
      if (startDate) where.detectionTime.gte = new Date(startDate as string);
      if (endDate) where.detectionTime.lte = new Date(endDate as string);
    }

    const [alarms, total] = await Promise.all([
      prisma.alarm.findMany({
        where,
        include: {
          camera: {
            select: {
              id: true,
              name: true,
              site: { select: { id: true, name: true, address: true } },
            },
          },
        },
        orderBy: { detectionTime: "desc" },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.alarm.count({ where }),
    ]);

    res.json({ alarms, total, limit: parseInt(limit as string), offset: parseInt(offset as string) });
  } catch (error) {
    logger.error("List alarms error:", error);
    res.status(500).json({ error: "Failed to list alarms" });
  }
});

// 알람 상세 조회
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const alarm = await prisma.alarm.findUnique({
      where: { id },
      include: {
        camera: {
          select: {
            id: true,
            name: true,
            site: { select: { id: true, name: true, address: true } },
          },
        },
        acknowledgements: {
          include: { user: { select: { id: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!alarm) {
      return res.status(404).json({ error: "Alarm not found" });
    }

    res.json(alarm);
  } catch (error) {
    logger.error("Get alarm error:", error);
    res.status(500).json({ error: "Failed to get alarm" });
  }
});

// 알람 상태 변경
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["NEW", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "FALSE_ALARM"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const alarm = await prisma.alarm.update({
      where: { id },
      data: { status },
    });

    logger.info(`Alarm status updated: ${id} -> ${status}`);
    res.json(alarm);
  } catch (error) {
    logger.error("Update alarm status error:", error);
    res.status(500).json({ error: "Failed to update alarm status" });
  }
});

// 알람 스냅샷 조회
router.get("/:id/snapshot", async (req, res) => {
  try {
    const { id } = req.params;

    const alarm = await prisma.alarm.findUnique({
      where: { id },
      select: { snapshotPath: true },
    });

    if (!alarm) {
      return res.status(404).json({ error: "Alarm not found" });
    }

    if (!alarm.snapshotPath || !fs.existsSync(alarm.snapshotPath)) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    res.sendFile(path.resolve(alarm.snapshotPath));
  } catch (error) {
    logger.error("Get alarm snapshot error:", error);
    res.status(500).json({ error: "Failed to get snapshot" });
  }
});

// 알람 통계
router.get("/stats/summary", async (req, res) => {

  try {
    const { siteId, startDate, endDate } = req.query;

    const where: any = {};
    if (siteId) {
      where.camera = { siteId };
    }
    if (startDate || endDate) {
      where.detectionTime = {};
      if (startDate) where.detectionTime.gte = new Date(startDate as string);
      if (endDate) where.detectionTime.lte = new Date(endDate as string);
    }

    const [total, byStatus, bySeverity, byEventType] = await Promise.all([
      prisma.alarm.count({ where }),
      prisma.alarm.groupBy({
        by: ["status"],
        where,
        _count: true,
      }),
      prisma.alarm.groupBy({
        by: ["severity"],
        where,
        _count: true,
      }),
      prisma.alarm.groupBy({
        by: ["eventType"],
        where,
        _count: true,
      }),
    ]);

    res.json({
      total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      bySeverity: Object.fromEntries(bySeverity.map((s) => [s.severity, s._count])),
      byEventType: Object.fromEntries(byEventType.map((e) => [e.eventType, e._count])),
    });
  } catch (error) {
    logger.error("Get alarm stats error:", error);
    res.status(500).json({ error: "Failed to get alarm statistics" });
  }
});

export default router;
