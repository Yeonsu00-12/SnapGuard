import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { Request } from "express";
import logger from "../utils/logger";

const router = Router();
const prisma = new PrismaClient();

/**
 * 리포트 생성
 */
router.post("/", async (req: Request, res) => {
  try {
    const {
      alarmIds,
      createdBy,
      attentionOf,
      authorizedBy,
      incidentType,
      incidentSubCategory,
      policeReference,
      notes,
    } = req.body;

    if (!alarmIds || !Array.isArray(alarmIds) || alarmIds.length === 0) {
      return res.status(400).json({ error: "alarmIds is required" });
    }

    // 알람들 조회
    const alarms = await prisma.alarm.findMany({
      where: { id: { in: alarmIds } },
      include: {
        camera: {
          include: { site: true },
        },
      },
      orderBy: { detectionTime: "asc" },
    });

    if (alarms.length === 0) {
      return res.status(404).json({ error: "No alarms found" });
    }

    // 시간 범위 계산
    const eventStartTime = alarms[0].detectionTime;
    const eventEndTime = alarms[alarms.length - 1].detectionTime;

    // 사이트 정보 (첫 번째 알람 기준)
    const site = alarms[0].camera.site;
    const siteName = site?.name || alarms[0].camera.name;
    const siteAddress = site?.address || "";

    // 리포트 제목 생성
    const dateStr = eventStartTime.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const title = `Security Incident Report - ${siteName} - ${dateStr}`;

    // 리포트 생성
    const report = await prisma.report.create({
      data: {
        title,
        siteId: site?.id,
        siteName,
        siteAddress,
        eventStartTime,
        eventEndTime,
        createdById: "test-user-id",
        createdByEmail: createdBy || "test@test.com",
        attentionOf,
        authorizedBy,
        incidentType,
        incidentSubCategory,
        policeReference,
        alarmIds: JSON.stringify(alarmIds),
        notes,
      },
    });

    logger.info(`Report created: ${report.id}`);

    res.status(201).json(report);
  } catch (error) {
    logger.error("Failed to create report:", error);
    res.status(500).json({ error: "Failed to create report" });
  }
});

export default router;
