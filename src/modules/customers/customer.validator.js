import { z } from "zod";
import { objectIdSchema, paginationQuerySchema } from "../common/validation.js";

export const customerIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const customerQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["active", "suspended", "pending"]).optional(),
  search: z.string().optional(),
});

export const createCustomerSchema = z.object({
  fullName: z.string().min(3).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  phone: z.string().min(6).max(20),
  address: z.string().max(160).optional(),
  role: z.enum(["customer", "admin", "distributor", "support"]).default("customer"),
  status: z.enum(["active", "suspended", "pending"]).default("active"),
});

export const updateCustomerSchema = z
  .object({
    fullName: z.string().min(3).max(80).optional(),
    phone: z.string().min(6).max(20).optional(),
    address: z.string().max(160).optional(),
    status: z.enum(["active", "suspended", "pending"]).optional(),
    role: z.enum(["customer", "admin", "distributor", "support"]).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Provide at least one field to update",
  });
