import { Router } from "express";
import { requireAuth, requireRole, requireSelfOrRole } from "../../middleware/ispAuth.js";
import { validateRequest } from "../../validators/validateRequest.js";
import CustomerController from "./customer.controller.js";
import {
  createCustomerSchema,
  customerIdParamsSchema,
  customerQuerySchema,
  updateCustomerSchema,
} from "./customer.validator.js";

const router = Router();

router.get("/me", requireAuth, CustomerController.me);
router.get(
  "/",
  requireAuth,
  requireRole("admin", "agent", "tech_support", "system_engineer", "customer_service"),
  validateRequest({ query: customerQuerySchema }),
  CustomerController.list
);
router.get(
  "/:id",
  requireAuth,
  requireSelfOrRole("id", "admin", "agent", "tech_support", "system_engineer", "customer_service"),
  validateRequest({ params: customerIdParamsSchema }),
  CustomerController.getById
);
router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validateRequest({ body: createCustomerSchema }),
  CustomerController.create
);
router.patch(
  "/:id",
  requireAuth,
  requireSelfOrRole("id", "admin", "agent", "tech_support", "system_engineer", "customer_service"),
  validateRequest({ params: customerIdParamsSchema, body: updateCustomerSchema }),
  CustomerController.update
);
router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validateRequest({ params: customerIdParamsSchema }),
  CustomerController.remove
);

export default router;
