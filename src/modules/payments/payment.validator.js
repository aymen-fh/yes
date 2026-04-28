import { z } from "zod";
import { objectIdSchema, paginationQuerySchema } from "../common/validation.js";

export const paymentIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const paymentQuerySchema = paginationQuerySchema.extend({
  customerId: objectIdSchema.optional(),
  subscriptionId: objectIdSchema.optional(),
  status: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
});

export const createPaymentSchema = z.object({
  customerId: objectIdSchema,
  subscriptionId: objectIdSchema,
  amount: z.number().min(0),
  vatAmount: z.number().min(0).default(0),
  totalAmount: z.number().min(0),
  currency: z.string().min(3).max(3).default("EGP"),
  method: z.enum(["cash", "card", "bank_transfer", "wallet"]).default("cash"),
  status: z.enum(["pending", "paid", "failed", "refunded"]).default("pending"),
  dueDate: z.coerce.date(),
  paidAt: z.coerce.date().optional(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  note: z.string().max(240).optional(),
});

export const updatePaymentSchema = z
  .object({
    status: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
    method: z.enum(["cash", "card", "bank_transfer", "wallet"]).optional(),
    paidAt: z.coerce.date().optional().nullable(),
    note: z.string().max(240).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Provide at least one field to update",
  });
