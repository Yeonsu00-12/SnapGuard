import { PrismaClient } from "@prisma/client";
import { NotificationService } from "./notification.service";
import { FFmpegCaptureService } from "./ffmpeg-capture.service";
import logger from "../utils/logger";

const prisma = new PrismaClient();

/**
 * 이메일 데이터 인터페이스
 */
interface EmailData {
  /** 발신자 (CCTV 카메라) */
  from: string;
  /** 수신자 목록 */
  to: string[];
  /** 이메일 제목 (이벤트 타입) */
  subject: string;
  /** 이메일 원본 본문 */
  body: string;
  /** 이벤트 발생 시간 */
  timestamp: string;
  /** 첨부파일 경로 목록 (스냅샷 이미지) */
  attachments: string[];
}

/**
 * ========================================
 * SMTP 알람 서비스
 * ========================================
 *
 * CCTV 카메라에서 수신한 이메일을 알람으로 변환
 *
 * 처리 흐름:
 * 1. 이메일에서 카메라 IP 추출
 * 2. 이메일 제목에서 이벤트 타입 추출
 * 3. DB에서 해당 카메라 조회
 * 4. 알람 레코드 생성
 * 5. 실시간 알림 발송
 * 6. 영상 클립 캡처 (백그라운드)
 */
export class SmtpAlarmService {
  /**
   * 이메일을 알람으로 변환
   * - SmtpServerService에서 직접 호출
   *
   * @param emailData - 수신된 이메일 데이터
   */
  static async handleEmail(emailData: EmailData): Promise<void> {
    try {
      logger.info(`[SmtpAlarm] Processing email from: ${emailData.from}`);
      logger.info(`[SmtpAlarm] Subject: ${emailData.subject}`);

      /** 1. 카메라 IP 추출 (From 필드 또는 본문에서) */
      const cameraIp = this.extractCameraIp(emailData);
      if (!cameraIp) {
        logger.warn("[SmtpAlarm] Could not extract camera IP from email");
      }

      /** 2. 이벤트 타입 추출 (Subject에서) */
      const eventType = this.extractEventType(emailData.subject);

      /** 3. DB에서 카메라 조회 */
      let camera;
      if (cameraIp) {
        camera = await prisma.camera.findFirst({
          where: { ipAddress: cameraIp },
          include: { site: true },
        });
      }

      /** IP로 못 찾으면 첫 번째 카메라 사용 */
      if (!camera) {
        camera = await prisma.camera.findFirst({
          include: { site: true },
        });
        if (camera) {
          logger.info(`[SmtpAlarm] Using first available camera: ${camera.name}`);
        }
      }

      if (!camera) {
        logger.error("[SmtpAlarm] No camera found in database");
        return;
      }

      logger.info(`[SmtpAlarm] Matched camera: ${camera.name} (${camera.ipAddress})`);

      /** 4. 스냅샷 경로 (첨부파일이 있으면 사용, 상대 경로로 변환) */
      let snapshotPath: string | null = null;
      if (emailData.attachments.length > 0) {
        const absolutePath = emailData.attachments[0];
        const uploadsIndex = absolutePath.indexOf("/uploads/");
        if (uploadsIndex !== -1) {
          snapshotPath = absolutePath.substring(uploadsIndex);
        } else {
          snapshotPath = absolutePath;
        }
      }

      /** 5. 알람 생성 */
      const alarm = await prisma.alarm.create({
        data: {
          cameraId: camera.id,
          eventType,
          severity: this.determineSeverity(eventType),
          detectionTime: new Date(),
          snapshotPath,
          rawEventData: JSON.stringify({
            source: "smtp",
            from: emailData.from,
            subject: emailData.subject,
            timestamp: emailData.timestamp,
          }),
        },
        include: {
          camera: { select: { id: true, name: true } },
        },
      });

      logger.info(`[SmtpAlarm] Alarm created: ${alarm.id} - ${eventType} for camera ${camera.name}`);

      /** 6. 알림 발송 */
      await NotificationService.sendAlarmNotification(alarm);
      logger.info(`[SmtpAlarm] Notification sent for alarm: ${alarm.id}`);

      /** 7. 영상 클립 캡처 (백그라운드, 3초) */
      const rtspUrl = camera.rtspSubStream || camera.rtspMainStream;
      if (rtspUrl) {
        this.captureVideoClipAsync(alarm.id, rtspUrl, 3);
      } else {
        logger.warn(`[SmtpAlarm] No RTSP URL for camera ${camera.name}, skipping video clip`);
      }

    } catch (error) {
      logger.error("[SmtpAlarm] Error processing email to alarm:", error);
    }
  }

  /**
   * 백그라운드에서 영상 클립 캡처
   */
  private static async captureVideoClipAsync(alarmId: string, rtspUrl: string, durationSeconds: number = 3): Promise<void> {
    try {
      logger.info(`[SmtpAlarm] Starting ${durationSeconds}s video clip capture for alarm ${alarmId}`);

      const filename = `alarm_${alarmId}_${Date.now()}.mp4`;
      const videoPath = await FFmpegCaptureService.captureVideoClip(rtspUrl, durationSeconds, filename);

      // 상대 경로로 변환
      const uploadsIndex = videoPath.indexOf("/uploads/");
      const relativePath = uploadsIndex !== -1
        ? videoPath.substring(uploadsIndex)
        : `/uploads/clips/${filename}`;

      // 알람 업데이트
      await prisma.alarm.update({
        where: { id: alarmId },
        data: { videoPath: relativePath },
      });

      logger.info(`[SmtpAlarm] Video clip saved for alarm ${alarmId}: ${relativePath}`);
    } catch (error) {
      logger.error(`[SmtpAlarm] Failed to capture video clip for alarm ${alarmId}:`, error);
    }
  }

  /**
   * 이메일에서 카메라 IP 추출
   *
   * 추출 우선순위:
   * 1. From 필드 (예: camera@192.168.0.64)
   * 2. Subject 필드
   * 3. 본문의 IP ADDRESS: 패턴
   * 4. 본문의 아무 IP
   *
   * @param emailData - 이메일 데이터
   * @returns 카메라 IP 또는 null
   */
  private static extractCameraIp(emailData: EmailData): string | null {
    /** 1. From 필드에서 IP 추출 */
    const fromIpMatch = emailData.from.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (fromIpMatch) {
      return fromIpMatch[1];
    }

    /** 2. Subject에서 IP 추출 */
    const subjectIpMatch = emailData.subject.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (subjectIpMatch) {
      return subjectIpMatch[1];
    }

    /** 3. 본문에서 IP ADDRESS: 패턴 찾기 */
    const bodyIpMatch = emailData.body.match(/IP\s*ADDRESS[:\s]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i);
    if (bodyIpMatch) {
      return bodyIpMatch[1];
    }

    /** 4. 본문에서 아무 IP나 찾기 */
    const anyIpMatch = emailData.body.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (anyIpMatch) {
      return anyIpMatch[1];
    }

    return null;
  }

  /**
   * 이벤트 타입 반환
   * - 현재 MOTION_DETECTED만 사용
   */
  private static extractEventType(_subject: string): string {
    return "MOTION_DETECTED";
  }

  /**
   * 심각도 반환
   * - 현재 MOTION_DETECTED만 사용하므로 LOW 고정
   */
  private static determineSeverity(_eventType: string): string {
    return "LOW";
  }
}
