import { z } from "zod";
import { objectIdSchema, paginationQuerySchema } from "../common/validation.js";

export const supportTicketIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const supportTicketQuerySchema = paginationQuerySchema.extend({
  customerId: objectIdSchema.optional(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

export const createSupportTicketSchema = z.object({
  customerId: objectIdSchema.optional(),
  subscriptionId: objectIdSchema.optional(),
  subject: z.string().min(4).max(140),
  description: z.string().min(10).max(1000),
  category: z.enum(["technical", "billing", "account", "other"]).default("technical"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

export const updateSupportTicketSchema = z
  .object({
    status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    assignedTo: objectIdSchema.optional().nullable(),
    resolutionNote: z.string().max(1000).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Provide at least one field to update",
  });

export const createSupportTicketReplySchema = z.object({
  message: z.string().min(2).max(1000),
});
