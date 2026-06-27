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

export const dashboardMetaSchema = z
  .object({
    chatSessionId: z.string().nullable().optional(),
    aiCategory: z.string().nullable().optional(),
    aiSummary: z.string().nullable().optional(),
    routedToRole: z
      .enum(["admin", "agent", "customer_service", "tech_support", "system_engineer"])
      .nullable()
      .optional(),
    routedToDepartment: z.string().nullable().optional(),
    routedByName: z.string().nullable().optional(),
    routedAt: z.string().nullable().optional(),
    resolutionOutcome: z.enum(["pending", "resolved", "not_resolved"]).nullable().optional(),
    specialistResponse: z.string().nullable().optional(),
    specialistName: z.string().nullable().optional(),
    specialistRespondedAt: z.string().nullable().optional(),
    assignedEngineerId: z.string().nullable().optional(),
    assignedEngineerName: z.string().nullable().optional(),
  })
  .optional();

export const createSupportTicketSchema = z
  .object({
    customerId: objectIdSchema.optional(),
    customerPhone: z.string().min(5).max(30).optional(),
    customerName: z.string().min(2).max(120).optional(),
    subscriptionId: objectIdSchema.optional(),
    subject: z.string().min(4).max(140),
    description: z.string().min(10).max(1000),
    category: z.enum(["technical", "billing", "account", "other"]).default("technical"),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    dashboardMeta: dashboardMetaSchema,
  })
  .refine((input) => Boolean(input.customerId || input.customerPhone), {
    message: "customerId or customerPhone is required",
  });

export const updateSupportTicketSchema = z
  .object({
    status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    assignedTo: objectIdSchema.optional().nullable(),
    resolutionNote: z.string().max(1000).optional(),
    resolvedAt: z.union([z.string(), z.date()]).optional().nullable(),
    dashboardMeta: dashboardMetaSchema,
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Provide at least one field to update",
  });

export const createSupportTicketReplySchema = z.object({
  message: z.string().min(2).max(1000),
});
