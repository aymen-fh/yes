import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/ispAuth.js";
import { validateRequest } from "../../validators/validateRequest.js";
import PaymentController from "./payment.controller.js";
import {
  createPaymentSchema,
  paymentIdParamsSchema,
  paymentQuerySchema,
  updatePaymentSchema,
} from "./payment.validator.js";

const router = Router();

router.get("/", requireAuth, validateRequest({ query: paymentQuerySchema }), PaymentController.list);
router.get("/stats", requireAuth, requireRole("admin", "distributor", "support"), PaymentController.stats);
router.get("/:id", requireAuth, validateRequest({ params: paymentIdParamsSchema }), PaymentController.getById);
router.post(
  "/",
  requireAuth,
  requireRole("admin", "distributor", "support"),
  validateRequest({ body: createPaymentSchema }),
  PaymentController.create
);
router.patch(
  "/:id",
  requireAuth,
  requireRole("admin", "distributor", "support"),
  validateRequest({ params: paymentIdParamsSchema, body: updatePaymentSchema }),
  PaymentController.update
);

export default router;
