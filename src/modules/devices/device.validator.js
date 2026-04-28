import { z } from "zod";
import { objectIdSchema, paginationQuerySchema } from "../common/validation.js";

export const deviceIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const deviceQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["online", "offline", "maintenance", "fault"]).optional(),
  customerId: objectIdSchema.optional(),
});

export const createDeviceSchema = z.object({
  serialNumber: z.string().min(3).max(60),
  model: z.string().min(2).max(80),
  macAddress: z.string().min(8).max(30),
  firmwareVersion: z.string().max(40).optional(),
  ipAddress: z.string().max(40).optional(),
  status: z.enum(["online", "offline", "maintenance", "fault"]).default("offline"),
  customerId: objectIdSchema.optional(),
  subscriptionId: objectIdSchema.optional(),
});

export const updateDeviceSchema = z
  .object({
    model: z.string().min(2).max(80).optional(),
    firmwareVersion: z.string().max(40).optional(),
    ipAddress: z.string().max(40).optional(),
    status: z.enum(["online", "offline", "maintenance", "fault"]).optional(),
    customerId: objectIdSchema.optional().nullable(),
    subscriptionId: objectIdSchema.optional().nullable(),
    lastSeenAt: z.coerce.date().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Provide at least one field to update",
  });
