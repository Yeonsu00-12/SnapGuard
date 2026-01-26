import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import nodemailer from "nodemailer";
import logger from "../utils/logger";
import { SmtpAlarmService } from "./smtp-alarm.service";

/**
 * ========================================
 * Gmail 릴레이 설정 (환경변수)
 * ========================================
 *
 * GMAIL_USER (또는 SMTP_USER)      - Gmail 계정 이메일
 * GMAIL_APP_PASSWORD (또는 SMTP_PASS) - Gmail 앱 비밀번호
 * ALERT_EMAIL_TO                   - 알림 수신자 (기본값: GMAIL_USER)
 *
 * Gmail 앱 비밀번호 발급 방법:
 * 1. Google 계정 → 보안 → 2단계 인증 활성화
 * 2. 앱 비밀번호 생성 → 16자리 코드 사용
 */
const GMAIL_USER = process.env.GMAIL_USER || process.env.SMTP_USER || "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || "";
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || GMAIL_USER;

/** Gmail 릴레이 활성화 여부 (계정 정보가 모두 설정된 경우) */
const RELAY_TO_EMAIL = GMAIL_USER && GMAIL_APP_PASSWORD;

/**
 * ========================================
 * 파일 저장 경로
 * ========================================
 */

/** 첨부파일(스냅샷 이미지) 저장 경로 */
const ATTACHMENTS_DIR = path.join(process.cwd(), "uploads", "smtp-attachments");

/** 이메일 원본 JSON 저장 경로 */
const EMAILS_DIR = path.join(process.cwd(), "uploads", "smtp-emails");

/** 디렉토리 생성 (존재하지 않는 경우) */
if (!fs.existsSync(ATTACHMENTS_DIR)) {
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
}
if (!fs.existsSync(EMAILS_DIR)) {
  fs.mkdirSync(EMAILS_DIR, { recursive: true });
}

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
 * SMTP 서버 서비스
 * ========================================
 *
 * CCTV 카메라의 이메일 알림을 수신하는 간이 SMTP 서버
 *
 * 동작 흐름:
 * 1. CCTV 카메라가 이벤트 발생 시 이메일 전송
 * 2. 이 서버가 이메일 수신 (포트 2525)
 * 3. 첨부된 스냅샷 이미지 저장
 * 4. Gmail을 통해 사용자에게 알림 전달 (선택사항)
 * 5. 'email-received' 이벤트 발생 → 알람 서비스에서 처리
 */
export class SmtpServerService {
  /** TCP 서버 인스턴스 */
  private static server: net.Server | null = null;

  /** Gmail 릴레이용 Nodemailer 트랜스포터 */
  private static gmailTransporter: nodemailer.Transporter | null = null;

  /**
   * SMTP 서버 시작
   * @param port - 리스닝 포트 (기본값: 2525)
   */
  static start(port: number = 2525): void {
    if (this.server) {
      logger.warn("SMTP server already running");
      return;
    }

    /** Gmail 릴레이 트랜스포터 설정 */
    if (RELAY_TO_EMAIL) {
      this.gmailTransporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: GMAIL_USER,
          pass: GMAIL_APP_PASSWORD,
        },
      });
      logger.info(`Email forwarding enabled: ${GMAIL_USER} → ${ALERT_EMAIL_TO}`);
    }

    /** TCP 서버 생성 */
    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    /** 서버 시작 */
    this.server.listen(port, "0.0.0.0", () => {
      logger.info(`========================================`);
      logger.info(`SMTP Server started on port ${port}`);
      logger.info(`Host: 0.0.0.0 (all interfaces)`);
      logger.info(`Email forwarding: ${RELAY_TO_EMAIL ? `enabled (→ ${ALERT_EMAIL_TO})` : "disabled"}`);
      logger.info(`========================================`);
    });

    /** 서버 에러 핸들링 */
    this.server.on("error", (err) => {
      logger.error("SMTP Server error:", err);
    });
  }

  /**
   * SMTP 서버 중지
   */
  static stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      logger.info("SMTP Server stopped");
    }
  }

  /**
   * 클라이언트(CCTV) 연결 처리
   *
   * SMTP 프로토콜 흐름:
   * 1. 서버 → 클라이언트: 220 배너 (환영 메시지)
   * 2. 클라이언트: HELO/EHLO (인사)
   * 3. 클라이언트: MAIL FROM (발신자)
   * 4. 클라이언트: RCPT TO (수신자)
   * 5. 클라이언트: DATA (본문 시작)
   * 6. 클라이언트: 이메일 내용 + <CRLF>.<CRLF> (종료)
   * 7. 클라이언트: QUIT (연결 종료)
   *
   * @param socket - 클라이언트 소켓
   */
  private static handleConnection(socket: net.Socket): void {
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    logger.info(`[SMTP] Client connected: ${clientAddress}`);

    /** 상태 변수 */
    let emailBuffer = "";      // 이메일 본문 버퍼
    let isDataMode = false;    // DATA 명령 후 본문 수신 모드
    let mailFrom = "";         // 발신자 주소
    let rcptTo: string[] = []; // 수신자 주소 목록

    /** SMTP 220 배너 전송 (연결 성공 알림) */
    socket.write("220 CCTV SMTP Server Ready\r\n", (err) => {
      if (err) {
        console.error(`Failed to send 220 banner: ${err.message}`);
      } else {
        console.log("220 banner sent successfully");
      }
    });

    /** 데이터 수신 핸들러 */
    socket.on("data", (chunk) => {
      const data = chunk.toString();

      /**
       * DATA 모드: 이메일 본문 수신 중
       * - 종료 시퀀스 <CRLF>.<CRLF> 감지 시 처리
       */
      if (isDataMode) {
        emailBuffer += data;

        if (data.includes("\r\n.\r\n")) {
          isDataMode = false;

          /** 이메일 파싱 및 저장 */
          this.processEmail(emailBuffer, mailFrom, rcptTo);

          /** 상태 초기화 */
          emailBuffer = "";
          mailFrom = "";
          rcptTo = [];

          this.sendResponse(socket, "250 OK: Message received");
        }
        return;
      }

      /** SMTP 명령어 파싱 */
      const command = data.trim().toUpperCase();
      const originalData = data.trim();

      /**
       * SMTP 명령어 처리
       */
      if (command.startsWith("HELO") || command.startsWith("EHLO")) {
        /** HELO/EHLO: 클라이언트 인사 */
        this.sendResponse(socket, "250 Hello, pleased to meet you");
      } else if (command.startsWith("MAIL FROM:")) {
        /** MAIL FROM: 발신자 설정 */
        mailFrom = originalData.substring(10).replace(/[<>]/g, "").trim();
        this.sendResponse(socket, "250 OK");
      } else if (command.startsWith("RCPT TO:")) {
        /** RCPT TO: 수신자 추가 */
        const recipient = originalData.substring(8).replace(/[<>]/g, "").trim();
        rcptTo.push(recipient);
        this.sendResponse(socket, "250 OK");
      } else if (command === "DATA") {
        /** DATA: 이메일 본문 시작 */
        this.sendResponse(socket, "354 Start mail input; end with <CRLF>.<CRLF>");
        isDataMode = true;
      } else if (command === "QUIT") {
        /** QUIT: 연결 종료 */
        this.sendResponse(socket, "221 Bye");
        socket.end();
      } else if (command === "RSET") {
        /** RSET: 상태 초기화 */
        emailBuffer = "";
        mailFrom = "";
        rcptTo = [];
        this.sendResponse(socket, "250 OK");
      } else if (command === "NOOP") {
        /** NOOP: 연결 유지 (no operation) */
        this.sendResponse(socket, "250 OK");
      } else {
        /** 알 수 없는 명령 */
        this.sendResponse(socket, "500 Command not recognized");
      }
    });

    /** 소켓 에러 핸들러 */
    socket.on("error", (err) => {
      logger.error(`[SMTP] Socket error (${clientAddress}):`, err.message);
    });

    /** 연결 종료 핸들러 */
    socket.on("close", () => {
      logger.info(`[SMTP] Client disconnected: ${clientAddress}`);
    });
  }

  /**
   * SMTP 응답 전송
   * @param socket - 클라이언트 소켓
   * @param message - 응답 메시지 (예: "250 OK")
   */
  private static sendResponse(socket: net.Socket, message: string): void {
    socket.write(`${message}\r\n`);
  }

  /**
   * 이메일 처리
   *
   * 처리 순서:
   * 1. 제목(Subject) 추출
   * 2. 이벤트 시간(EVENT TIME) 추출 - Hikvision 형식
   * 3. Base64 첨부파일(스냅샷) 디코딩 및 저장
   * 4. 이메일 데이터 JSON 저장
   * 5. 'email-received' 이벤트 발생
   * 6. Gmail 릴레이 (설정된 경우)
   *
   * @param rawEmail - 원본 이메일 데이터
   * @param from - 발신자 주소
   * @param to - 수신자 주소 목록
   */
  private static async processEmail(
    rawEmail: string,
    from: string,
    to: string[]
  ): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    logger.info(`\n${"=".repeat(50)}`);
    logger.info(`[SMTP] New email received`);
    logger.info(`${"=".repeat(50)}`);
    logger.info(`From: ${from}`);
    logger.info(`To: ${to.join(", ")}`);

    /** 제목 추출 */
    const subjectMatch = rawEmail.match(/Subject:\s*(.+)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : "No Subject";
    logger.info(`Subject: ${subject}`);

    /** 이벤트 시간 추출 (Hikvision 이메일 형식) */
    const eventTimeMatch = rawEmail.match(/EVENT TIME:\s*(.+)/i);
    const eventTime = eventTimeMatch ? eventTimeMatch[1].trim() : timestamp;

    /**
     * 첨부파일(이미지) 추출
     * - MIME multipart 형식에서 boundary로 파트 분리
     * - Base64 인코딩된 이미지 디코딩
     */
    const attachments: string[] = [];
    const boundaryMatch = rawEmail.match(/boundary="(.+?)"/);

    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = rawEmail.split(`--${boundary}`);

      for (const part of parts) {
        if (part.includes("Content-Transfer-Encoding: base64")) {
          const base64Match = part.match(
            /Content-Transfer-Encoding:\s*base64\s+([\s\S]+?)(?=--|$)/i
          );

          if (base64Match) {
            const base64Data = base64Match[1].replace(/\s/g, "").trim();

            /** 이미지 파일 저장 */
            const filename = `${timestamp}_${attachments.length + 1}.jpg`;
            const filePath = path.join(ATTACHMENTS_DIR, filename);

            try {
              const buffer = Buffer.from(base64Data, "base64");
              fs.writeFileSync(filePath, buffer);
              attachments.push(filePath);
              logger.info(`Attachment saved: ${filename} (${buffer.length} bytes)`);
            } catch (err) {
              logger.error(`Failed to save attachment: ${err}`);
            }
          }
        }
      }
    }

    /** 이메일 데이터 구성 */
    const emailData: EmailData = {
      from,
      to,
      subject,
      body: rawEmail,
      timestamp: eventTime,
      attachments,
    };

    /** 이메일 JSON 파일 저장 */
    const emailFile = path.join(EMAILS_DIR, `${timestamp}.json`);
    fs.writeFileSync(emailFile, JSON.stringify(emailData, null, 2));
    logger.info(`Email saved: ${emailFile}`);

    /** 알람 서비스로 이메일 전달 */
    await SmtpAlarmService.handleEmail(emailData);

    /** Gmail 릴레이 (사용자에게 알림 전달) */
    if (RELAY_TO_EMAIL && this.gmailTransporter) {
      try {
        await this.gmailTransporter.sendMail({
          from: GMAIL_USER,
          to: ALERT_EMAIL_TO,
          subject: `[CCTV Alert] ${subject}`,
          text: `CCTV 이벤트 알림

카메라 메일 발송자 : ${from}
시간: ${eventTime}
이벤트: ${subject}

자동 생성된 알림입니다.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h2 style="color: #d32f2f;">🚨 CCTV 이벤트 알림</h2>
              <table style="border-collapse: collapse; width: 100%;">
                <tr style="background: #f5f5f5;">
                  <td style="padding: 10px; border: 1px solid #ddd;"><b>카메라</b></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${from}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd;"><b>시간</b></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${eventTime}</td>
                </tr>
                <tr style="background: #f5f5f5;">
                  <td style="padding: 10px; border: 1px solid #ddd;"><b>이벤트</b></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${subject}</td>
                </tr>
              </table>
              <p style="color: #666; margin-top: 20px;">첨부된 스냅샷을 확인하세요.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">이 메일은 CCTV 모니터링 시스템에서 자동 발송되었습니다.</p>
            </div>
          `,
          attachments: attachments.map((filepath, idx) => ({
            filename: `snapshot_${idx + 1}.jpg`,
            path: filepath,
          })),
        });
        logger.info(`Email forwarded to: ${ALERT_EMAIL_TO}`);
      } catch (err) {
        logger.error(`Email forwarding failed: ${err}`);
      }
    }

    logger.info(`${"=".repeat(50)}\n`);
  }

  /**
   * 서버 실행 상태 확인
   * @returns 서버 실행 중이면 true
   */
  static isRunning(): boolean {
    return this.server !== null;
  }
}
