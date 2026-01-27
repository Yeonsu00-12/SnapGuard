import { PrismaClient } from "@prisma/client";
import { NotificationService } from "./notification.service";
import logger from "../utils/logger";

const prisma = new PrismaClient();

interface EmailData {
  from: string;
  to: string[];
  subject: string;
  body: string;
  timestamp: string;
  attachments: string[];
}

/**
 * SMTP 알람 서비스
 * CCTV 카메라에서 수신한 이메일을 알람으로 변환
 */
export class SmtpAlarmService {
  static async handleEmail(emailData: EmailData): Promise<void> {
    try {
      logger.info(`[SmtpAlarm] Processing email from: ${emailData.from}`);

      // 카메라 IP 추출
      const cameraIp = this.extractCameraIp(emailData);

      // DB에서 카메라 조회
      let camera;
      if (cameraIp) {
        camera = await prisma.camera.findFirst({
          where: { ipAddress: cameraIp },
          include: { site: true },
        });
      }

      // IP로 못 찾으면 첫 번째 카메라 사용
      if (!camera) {
        camera = await prisma.camera.findFirst({
          include: { site: true },
        });
      }

      if (!camera) {
        logger.error("[SmtpAlarm] No camera found in database");
        return;
      }

      logger.info(`[SmtpAlarm] Matched camera: ${camera.name} (${camera.ipAddress})`);

      // 스냅샷 경로 (첨부파일)
      let snapshotPath: string | null = null;
      if (emailData.attachments.length > 0) {
        const absolutePath = emailData.attachments[0];
        const uploadsIndex = absolutePath.indexOf("/uploads/");
        snapshotPath = uploadsIndex !== -1
          ? absolutePath.substring(uploadsIndex)
          : absolutePath;
      }

      // 알람 생성
      const alarm = await prisma.alarm.create({
        data: {
          cameraId: camera.id,
          eventType: "MOTION_DETECTED",
          severity: "LOW",
          detectionTime: new Date(),
          snapshotPath,
          rawEventData: JSON.stringify({
            source: "smtp",
            from: emailData.from,
            subject: emailData.subject,
          }),
        },
        include: {
          camera: { select: { id: true, name: true } },
        },
      });

      logger.info(`[SmtpAlarm] Alarm created: ${alarm.id}`);

      // 알림 발송
      await NotificationService.sendAlarmNotification(alarm);
      logger.info(`[SmtpAlarm] Notification sent for alarm: ${alarm.id}`);
    } catch (error) {
      logger.error("[SmtpAlarm] Error processing email:", error);
    }
  }

  private static extractCameraIp(emailData: EmailData): string | null {
    // From 필드에서 IP 추출
    const fromIpMatch = emailData.from.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (fromIpMatch) return fromIpMatch[1];

    // Subject에서 IP 추출
    const subjectIpMatch = emailData.subject.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (subjectIpMatch) return subjectIpMatch[1];

    // 본문에서 IP 추출
    const bodyIpMatch = emailData.body.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (bodyIpMatch) return bodyIpMatch[1];

    return null;
  }
}
