import { Router } from "express";
import rateLimit from "express-rate-limit";
import AuthController from "./auth.controller.js";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  requestLoginOtpSchema,
  verifyLoginOtpSchema,
} from "./auth.validator.js";
import { validateRequest } from "../../validators/validateRequest.js";
import { requireAuth } from "../../middleware/ispAuth.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 200 : 35,
  message: { success: false, message: "Too many login attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authLimiter, validateRequest({ body: registerSchema }), AuthController.register);
router.post("/login", authLimiter, validateRequest({ body: loginSchema }), AuthController.login);
router.post(
  "/request-login-otp",
  authLimiter,
  validateRequest({ body: requestLoginOtpSchema }),
  AuthController.requestLoginOtp
);
router.post(
  "/verify-login-otp",
  authLimiter,
  validateRequest({ body: verifyLoginOtpSchema }),
  AuthController.verifyLoginOtp
);
router.post(
  "/refresh-token",
  authLimiter,
  validateRequest({ body: refreshTokenSchema }),
  AuthController.refreshToken
);
router.post("/logout", requireAuth, AuthController.logout);

export default router;
