import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/ispAuth.js";
import { validateRequest } from "../../validators/validateRequest.js";
import SubscriptionController from "./subscription.controller.js";
import {
  createSubscriptionSchema,
  renewSubscriptionSchema,
  subscriptionIdParamsSchema,
  subscriptionQuerySchema,
  switchPlanSchema,
  topupSubmitSchema,
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
  "/:id/dashboard",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema }),
  SubscriptionController.dashboard
);
router.get(
  "/:id/usage",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema }),
  SubscriptionController.usage
);
router.get(
  "/:id/transactions",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema }),
  SubscriptionController.transactions
);
router.get(
  "/:id/plans",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema }),
  SubscriptionController.plans
);
router.post(
  "/:id/plans/switch",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema, body: switchPlanSchema }),
  SubscriptionController.switchPlan
);
router.post(
  "/:id/renew",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema, body: renewSubscriptionSchema }),
  SubscriptionController.renew
);
router.post(
  "/:id/topups/submit",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema, body: topupSubmitSchema }),
  SubscriptionController.submitTopup
);
router.post(
  "/",
  requireAuth,
  requireRole("admin", "agent", "tech_support", "system_engineer", "customer_service"),
  validateRequest({ body: createSubscriptionSchema }),
  SubscriptionController.create
);
router.patch(
  "/:id",
  requireAuth,
  requireRole("admin", "agent", "tech_support", "system_engineer", "customer_service"),
  validateRequest({ params: subscriptionIdParamsSchema, body: updateSubscriptionSchema }),
  SubscriptionController.update
);

// App specific nested routes
router.get("/:id/transactions", requireAuth, SubscriptionController.transactions);
router.post("/:id/topups/submit", requireAuth, SubscriptionController.topup);
router.get("/:id/plans", requireAuth, SubscriptionController.plans);
router.post("/:id/plans/switch", requireAuth, SubscriptionController.switchPlan);
router.post("/:id/plans/renew", requireAuth, SubscriptionController.renew);
router.get("/:id/tickets", requireAuth, SubscriptionController.tickets);
router.post("/:id/tickets", requireAuth, SubscriptionController.createTicket);

export default router;
