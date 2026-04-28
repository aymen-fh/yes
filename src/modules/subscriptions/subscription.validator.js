import { z } from "zod";
import { objectIdSchema, paginationQuerySchema } from "../common/validation.js";

export const subscriptionIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const subscriptionQuerySchema = paginationQuerySchema.extend({
  customerId: objectIdSchema.optional(),
  status: z.enum(["active", "pending", "suspended", "cancelled"]).optional(),
});

export const createSubscriptionSchema = z.object({
  customerId: objectIdSchema,
  planId: objectIdSchema,
  deviceId: objectIdSchema.optional(),
  status: z.enum(["active", "pending", "suspended", "cancelled"]).default("pending"),
  assignedIp: z.string().optional(),
  startedAt: z.coerce.date().optional(),
  durationMonths: z.coerce.number().int().min(1).max(24).default(1),
  nextBillingDate: z.coerce.date().optional(),
  dataUsageGb: z.number().min(0).default(0),
  notes: z.string().max(240).optional(),
});

export const renewSubscriptionSchema = z.object({
  months: z.coerce.number().int().min(1).max(12).default(1),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "wallet"]).default("card"),
  markAsPaid: z.boolean().default(true),
  currency: z.string().min(3).max(3).default("EGP"),
  note: z.string().max(240).optional(),
});

export const updateSubscriptionSchema = z
  .object({
    planId: objectIdSchema.optional(),
    deviceId: objectIdSchema.optional().nullable(),
    status: z.enum(["active", "pending", "suspended", "cancelled"]).optional(),
    assignedIp: z.string().optional(),
    nextBillingDate: z.coerce.date().optional(),
    dataUsageGb: z.number().min(0).optional(),
    notes: z.string().max(240).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Provide at least one field to update",
  });
