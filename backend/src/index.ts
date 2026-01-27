import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import session from "express-session";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { PrismaClient } from "@prisma/client";
import logger from "./utils/logger";
import routes from "./routes";
import { SmtpServerService } from "./services/smtp-server.service";
import { CameraHealthService } from "./services/camera-health.service";
import { HLSStreamService } from "./services/hls-stream.service";
import { MjpegStreamService } from "./services/mjpeg-stream.service";

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

// Socket.IO setup
const socketOrigins = (process.env.FRONTEND_URL || "http://localhost:3000").split(",").map(o => o.trim());
const io = new SocketServer(httpServer, {
  cors: {
    origin: socketOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on("subscribe:alarms", () => {
    socket.join("alarms");
    logger.debug(`Socket ${socket.id} subscribed to alarms`);
  });

  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// MJPEG 스트리밍 서비스 초기화 (Socket.IO 이벤트 등록)
MjpegStreamService.initialize(io);

// Middleware
app.use(helmet());
app.use(compression());

// CORS - support multiple origins from env (comma-separated)
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000").split(",").map(o => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 세션 설정
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // 개발환경에서는 false
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    },
  })
);

// Make io accessible to routes
app.set("io", io);

// HLS 미들웨어 (플레이리스트/세그먼트 헤더 설정) - 반드시 /uploads 전에 위치해야 함
app.use("/uploads/hls", (req, res, next) => {
  const url = req.url.toLowerCase();

  // CORS 헤더 (프론트엔드에서 hls.js가 요청)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  // m3u8 플레이리스트 - 캐시 비활성화 (항상 최신 플레이리스트 받도록)
  if (url.endsWith(".m3u8")) {
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  }
  // ts 세그먼트
  else if (url.endsWith(".ts")) {
    res.setHeader("Content-Type", "video/mp2t");
    res.setHeader("Cache-Control", "no-cache");
  }

  next();
}, express.static("uploads/hls"));

// Serve static files (snapshots) - HLS 다음에 위치
app.use("/uploads", express.static("uploads"));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api", routes);

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);

  // FFmpeg 프로세스 정리
  logger.info("Stopping all streams...");
  await HLSStreamService.killAllFFmpegProcesses();
  await MjpegStreamService.stopAllStreams();

  SmtpServerService.stop();
  CameraHealthService.stop();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export { prisma, io };
