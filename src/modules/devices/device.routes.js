import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/ispAuth.js";
import { validateRequest } from "../../validators/validateRequest.js";
import DeviceController from "./device.controller.js";
import {
  createDeviceSchema,
  deviceIdParamsSchema,
  deviceQuerySchema,
  updateDeviceSchema,
} from "./device.validator.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireRole("admin", "distributor", "support"),
  validateRequest({ query: deviceQuerySchema }),
  DeviceController.list
);
router.get(
  "/:id",
  requireAuth,
  requireRole("admin", "distributor", "support"),
  validateRequest({ params: deviceIdParamsSchema }),
  DeviceController.getById
);
router.post(
  "/",
  requireAuth,
  requireRole("admin", "distributor", "support"),
  validateRequest({ body: createDeviceSchema }),
  DeviceController.create
);
router.patch(
  "/:id",
  requireAuth,
  requireRole("admin", "distributor", "support"),
  validateRequest({ params: deviceIdParamsSchema, body: updateDeviceSchema }),
  DeviceController.update
);
router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validateRequest({ params: deviceIdParamsSchema }),
  DeviceController.remove
);

export default router;
