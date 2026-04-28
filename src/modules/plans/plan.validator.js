import { z } from "zod";
import { objectIdSchema, paginationQuerySchema } from "../common/validation.js";

export const planIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const planQuerySchema = paginationQuerySchema.extend({
  isActive: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
});

export const createPlanSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(100),
  speedMbps: z.number().int().min(1),
  dataLimitGb: z.number().int().min(1),
  monthlyPrice: z.number().min(0),
  durationMonths: z.number().int().min(1).max(24).default(1),
  vatPercent: z.number().min(0).max(100).default(15),
  isActive: z.boolean().default(true),
  description: z.string().max(300).optional(),
  features: z.array(z.string().max(80)).default([]),
});

export const updatePlanSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    speedMbps: z.number().int().min(1).optional(),
    dataLimitGb: z.number().int().min(1).optional(),
    monthlyPrice: z.number().min(0).optional(),
    durationMonths: z.number().int().min(1).max(24).optional(),
    vatPercent: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    description: z.string().max(300).optional(),
    features: z.array(z.string().max(80)).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Provide at least one field to update",
  });
