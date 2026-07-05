import { z } from "zod";

export const oxyChatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const notificationIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const notificationsQuerySchema = z.object({
  unreadOnly: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
