import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";

const router = Router();
const prisma = new PrismaClient();

// Register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "이메일과 비밀번호를 입력해주세요" });
    }

    // 이메일 중복 체크
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: "이미 사용 중인 이메일입니다" });
    }

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: password, // plain text
      },
    });

    logger.info(`User registered: ${email}`);
    res.json({
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error("Register error:", error);
    res.status(500).json({ error: "회원가입에 실패했습니다" });
  }
});

// Login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "이메일과 비밀번호를 입력해주세요" });
    }

    // DB에서 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: "이메일 또는 비밀번호가 올바르지 않습니다" });
    }

    logger.info(`User logged in: ${email}`);
    res.json({
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json({ error: "로그인에 실패했습니다" });
  }
});

// Logout
router.post("/logout", (req: Request, res: Response) => {
  res.json({ message: "Logged out successfully" });
});

export default router;
