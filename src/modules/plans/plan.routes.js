import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/ispAuth.js";
import { validateRequest } from "../../validators/validateRequest.js";
import PlanController from "./plan.controller.js";
import ServicePointController from "../servicePoints/servicePoint.controller.js";
import {
  createPlanSchema,
  planIdParamsSchema,
  planQuerySchema,
  updatePlanSchema,
} from "./plan.validator.js";

const router = Router();

router.get("/service-points", requireAuth, ServicePointController.list);
router.get("/", requireAuth, validateRequest({ query: planQuerySchema }), PlanController.list);
router.get("/:id", requireAuth, validateRequest({ params: planIdParamsSchema }), PlanController.getById);
router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validateRequest({ body: createPlanSchema }),
  PlanController.create
);
router.patch(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validateRequest({ params: planIdParamsSchema, body: updatePlanSchema }),
  PlanController.update
);
router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validateRequest({ params: planIdParamsSchema }),
  PlanController.remove
);

export default router;
