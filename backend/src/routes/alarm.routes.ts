import { Router } from "express";
import { prisma } from "../index";
import logger from "../utils/logger";
import path from "path";
import fs from "fs";

const router = Router();

// 알람 목록 조회 (현재 사용자가 접근 가능한 사이트의 알람만)
router.get("/", async (req, res) => {
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

    const where: any = {
      camera: {
        siteId: { in: accessibleSiteIds },
      },
    };

    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (cameraId) where.cameraId = cameraId;
    if (siteId) {
      // siteId가 접근 가능한 사이트인지 확인
      if (accessibleSiteIds.includes(siteId as string)) {
        where.camera.siteId = siteId;
      } else {
        return res.json({ alarms: [], total: 0, limit: parseInt(limit as string), offset: parseInt(offset as string) });
      }
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
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    const { id } = req.params;

    const alarm = await prisma.alarm.findUnique({
      where: { id },
      include: {
        camera: {
          select: {
            id: true,
            name: true,
            siteId: true,
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

    // 접근 권한 확인
    if (alarm.camera?.siteId) {
      const userSite = await prisma.userSite.findUnique({
        where: {
          userId_siteId: {
            userId: user.id,
            siteId: alarm.camera.siteId,
          },
        },
      });

      if (!userSite) {
        return res.status(403).json({ error: "이 알람에 접근 권한이 없습니다" });
      }
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
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["NEW", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "FALSE_ALARM"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // 알람 조회 및 권한 확인
    const existingAlarm = await prisma.alarm.findUnique({
      where: { id },
      include: { camera: { select: { siteId: true } } },
    });

    if (!existingAlarm) {
      return res.status(404).json({ error: "Alarm not found" });
    }

    if (existingAlarm.camera?.siteId) {
      const userSite = await prisma.userSite.findUnique({
        where: {
          userId_siteId: {
            userId: user.id,
            siteId: existingAlarm.camera.siteId,
          },
        },
      });

      if (!userSite) {
        return res.status(403).json({ error: "이 알람을 수정할 권한이 없습니다" });
      }
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
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    const { id } = req.params;

    const alarm = await prisma.alarm.findUnique({
      where: { id },
      select: {
        snapshotPath: true,
        camera: { select: { siteId: true } },
      },
    });

    if (!alarm) {
      return res.status(404).json({ error: "Alarm not found" });
    }

    // 접근 권한 확인
    if (alarm.camera?.siteId) {
      const userSite = await prisma.userSite.findUnique({
        where: {
          userId_siteId: {
            userId: user.id,
            siteId: alarm.camera.siteId,
          },
        },
      });

      if (!userSite) {
        return res.status(403).json({ error: "이 스냅샷에 접근 권한이 없습니다" });
      }
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

// 알람 통계 (현재 사용자가 접근 가능한 사이트의 알람만)
router.get("/stats/summary", async (req, res) => {
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

    const { siteId, startDate, endDate } = req.query;

    const where: any = {
      camera: {
        siteId: { in: accessibleSiteIds },
      },
    };

    if (siteId) {
      // siteId가 접근 가능한 사이트인지 확인
      if (accessibleSiteIds.includes(siteId as string)) {
        where.camera.siteId = siteId;
      } else {
        return res.json({ total: 0, byStatus: {}, bySeverity: {}, byEventType: {} });
      }
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
