import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/ispAuth.js";
import { validateRequest } from "../../validators/validateRequest.js";
import SubscriptionController from "./subscription.controller.js";
import {
  createSubscriptionSchema,
  renewSubscriptionSchema,
  subscriptionIdParamsSchema,
  subscriptionQuerySchema,
  updateSubscriptionSchema,
} from "./subscription.validator.js";

const router = Router();

router.get("/", requireAuth, validateRequest({ query: subscriptionQuerySchema }), SubscriptionController.list);
router.get(
  "/:id",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema }),
  SubscriptionController.getById
);
router.get(
  "/:id/usage",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema }),
  SubscriptionController.usage
);
router.post(
  "/:id/renew",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema, body: renewSubscriptionSchema }),
  SubscriptionController.renew
);
router.post(
  "/",
  requireAuth,
  requireRole("admin", "distributor", "support"),
  validateRequest({ body: createSubscriptionSchema }),
  SubscriptionController.create
);
router.patch(
  "/:id",
  requireAuth,
  requireRole("admin", "distributor", "support"),
  validateRequest({ params: subscriptionIdParamsSchema, body: updateSubscriptionSchema }),
  SubscriptionController.update
);

export default router;
