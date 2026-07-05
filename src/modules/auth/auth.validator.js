import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().min(3).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  phone: z.string().min(6).max(20),
  address: z.string().max(160).optional(),
});

export const loginSchema = z
  .object({
    identifier: z.string().min(3).optional(),
    email: z.string().email().optional(),
    password: z.string().min(1),
  })
  .refine((data) => Boolean(data.identifier || data.email), {
    message: "identifier or email is required",
    path: ["identifier"],
  });

export const requestLoginOtpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  purpose: z.enum(["login", "password_recovery"]).optional(),
});

export const requestRecoveryOtpSchema = z.object({
  email: z.string().email(),
});

export const verifyLoginOtpSchema = z.object({
  otpToken: z.string().min(10),
  code: z.string().regex(/^\d{6}$/),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});
