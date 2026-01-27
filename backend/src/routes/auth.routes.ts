import { Router, Request, Response } from "express";
import logger from "../utils/logger";

const router = Router();

// 고정 테스트 계정
const TEST_USER = {
  id: "test-user-id",
  email: "test@test.com",
  password: "test1234",
  name: "Test User",
  role: "ADMIN",
};

// Login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    if (email !== TEST_USER.email || password !== TEST_USER.password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    logger.info(`User logged in: ${email}`);
    res.json({
      user: {
        id: TEST_USER.id,
        email: TEST_USER.email,
        name: TEST_USER.name,
        role: TEST_USER.role,
      },
    });
  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Logout
router.post("/logout", (req: Request, res: Response) => {
  res.json({ message: "Logged out successfully" });
});

// Get current session (인증 없이 테스트 유저 반환)
router.get("/session", async (req: Request, res: Response) => {
  res.json({ user: TEST_USER });
});

export default router;
