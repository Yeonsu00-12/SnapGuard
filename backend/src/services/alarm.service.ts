import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import logger from "../utils/logger";
import { cryptoService } from "./crypto.service";
import { NotificationService } from "./notification.service";

const prisma = new PrismaClient();

interface DetectionEvent {
  cameraId: string;
  eventType: string;
  timestamp: Date;
  rawData?: any;
}

export class AlarmService {
  static async processEvent(event: DetectionEvent): Promise<void> {
    try {
      // 카메라 정보 조회
      const camera = await prisma.camera.findUnique({
        where: { id: event.cameraId },
        include: {
          site: true,
        },
      });

      if (!camera) {
        logger.warn(`Camera not found for event: ${event.cameraId}`);
        return;
      }

      // 스냅샷 캡쳐 시도
      let snapshotPath: string | null = null;

      try {
        snapshotPath = await this.captureSnapshot(camera);
      } catch (snapshotError) {
        logger.error(`Failed to capture snapshot for camera ${camera.name}:`, snapshotError);
      }

      // 알림 생성
      const alarm = await prisma.alarm.create({
        data: {
          cameraId: event.cameraId,
          eventType: event.eventType,
          severity: this.determineSeverity(event.eventType),
          detectionTime: event.timestamp,
          snapshotPath,
          rawEventData: event.rawData ? JSON.stringify(event.rawData) : null,
        },
        include: {
          camera: { select: { id: true, name: true } },
        },
      });

      logger.info(`Alarm created: ${event.eventType} for camera ${camera.name}`);

      // 알림 전송
      await NotificationService.sendAlarmNotification(alarm);
      logger.info(`Notification sent for alarm: ${alarm.id}`);
    } catch (error) {
      logger.error("Error processing detection event:", error);
      throw error;
    }
  }

  private static async captureSnapshot(camera: any): Promise<string | null> {
    try {
      // 암호화된 인증 정보 복호화
      const username = cryptoService.decrypt(
        camera.usernameEncrypted,
        camera.encryptionIV,
        camera.encryptionTag
      );
      const password = cryptoService.decrypt(
        camera.passwordEncrypted,
        camera.encryptionIV,
        camera.encryptionTag
      );

      // Hikvision 스냅샷 엔드포인트 URL
      const snapshotUrl = `http://${camera.ipAddress}:${camera.port}/ISAPI/Streaming/channels/101/picture`;

      const response = await axios.get(snapshotUrl, {
        auth: { username, password },
        responseType: "arraybuffer",
        timeout: 5000,
      });

      // w저장 디렉토리 확인 및 생성
      const uploadsDir = path.join(process.cwd(), "uploads", "snapshots");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // uuid 파일명으로 저장
      const filename = `${uuidv4()}.jpg`;
      const filepath = path.join(uploadsDir, filename);

      fs.writeFileSync(filepath, response.data);

      return filepath;
    } catch (error) {
      logger.error("Failed to capture snapshot:", error);
      return null;
    }
  }

  private static determineSeverity(eventType: string): string {
    const severityMap: Record<string, string> = {
      MOTION_DETECTED: "LOW",
      LINE_CROSSING: "MEDIUM",
      INTRUSION: "HIGH",
    };
    return severityMap[eventType] || "MEDIUM";
  }
}
