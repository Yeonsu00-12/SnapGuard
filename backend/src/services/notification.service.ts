import nodemailer from "nodemailer";
import { PrismaClient, Alarm } from "@prisma/client";
import logger from "../utils/logger";

const prisma = new PrismaClient();

export class NotificationService {
  private static transporter: nodemailer.Transporter | null = null;

  static async initializeTransporter(): Promise<void> {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.warn("SMTP 환경변수 미설정 (SMTP_HOST, SMTP_USER, SMTP_PASS)");
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || ""),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    try {
      await this.transporter.verify();
      logger.info("SMTP transporter initialized");
    } catch (error) {
      logger.error("SMTP 연결 실패:", error);
      this.transporter = null;
    }
  }

  static async sendAlarmNotification(alarm: Alarm & { camera: any }): Promise<void> {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      if (!this.transporter) {
        logger.debug("SMTP 미설정, 이메일 알림 건너뜀");
        return;
      }

      const recipients = process.env.NOTIFICATION_EMAILS?.split(",") || [];
      if (recipients.length === 0) {
        logger.debug("알림 수신자 미설정 (NOTIFICATION_EMAILS)");
        return;
      }

      const subject = `[CCTV Alert] ${alarm.eventType} - ${alarm.camera.name}`;
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #d32f2f;">Security Alert</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Event:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${alarm.eventType}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Camera:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${alarm.camera.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Time:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${alarm.detectionTime.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td>
            </tr>
          </table>
        </div>
      `;

      const attachments: any[] = [];
      if (alarm.snapshotPath) {
        attachments.push({
          filename: "snapshot.jpg",
          path: alarm.snapshotPath,
        });
      }

      for (const recipient of recipients) {
        try {
          await this.transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: recipient.trim(),
            subject,
            html: htmlBody,
            attachments,
          });

          await prisma.notification.create({
            data: {
              alarmId: alarm.id,
              type: "EMAIL",
              recipient: recipient.trim(),
              subject,
              body: htmlBody,
              status: "SENT",
              sentAt: new Date(),
            },
          });

          logger.info(`알림 발송 완료: ${recipient}`);
        } catch (error) {
          await prisma.notification.create({
            data: {
              alarmId: alarm.id,
              type: "EMAIL",
              recipient: recipient.trim(),
              subject,
              body: htmlBody,
              status: "FAILED",
              errorMessage: (error as Error).message,
            },
          });

          logger.error(`알림 발송 실패 (${recipient}):`, error);
        }
      }
    } catch (error) {
      logger.error("sendAlarmNotification 에러:", error);
    }
  }
}
