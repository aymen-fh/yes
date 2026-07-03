import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/ispAuth.js";
import { validateRequest } from "../../validators/validateRequest.js";
import SubscriptionController from "./subscription.controller.js";
import ServicePointController from "../servicePoints/servicePoint.controller.js";
import {
  createSubscriptionSchema,
  createTicketSchema,
  renewSubscriptionSchema,
  subscriptionIdParamsSchema,
  subscriptionQuerySchema,
  switchPlanSchema,
  topupSubmitSchema,
  advanceCreditRequestSchema,
  updateSubscriptionSchema,
} from "./subscription.validator.js";

const router = Router();

router.get("/service-points", requireAuth, ServicePointController.list);
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
  "/:id/usage/daily",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema }),
  SubscriptionController.dailyUsage
);
router.get(
  "/:id/speed-test/latest",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema }),
  SubscriptionController.latestSpeedTest
);
router.post(
  "/:id/speed-test",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema }),
  SubscriptionController.runSpeedTest
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
router.get(
  "/:id/advance-credit",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema }),
  SubscriptionController.getAdvanceCredit
);
router.post(
  "/:id/advance-credit/request",
  requireAuth,
  validateRequest({
    params: subscriptionIdParamsSchema,
    body: advanceCreditRequestSchema,
  }),
  SubscriptionController.requestAdvanceCredit
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

// App-specific aliases (validated)
router.post(
  "/:id/plans/renew",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema, body: renewSubscriptionSchema }),
  SubscriptionController.renew
);
router.get(
  "/:id/tickets",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema }),
  SubscriptionController.tickets
);
router.post(
  "/:id/tickets",
  requireAuth,
  validateRequest({ params: subscriptionIdParamsSchema, body: createTicketSchema }),
  SubscriptionController.createTicket
);

export default router;
