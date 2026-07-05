import { Router } from "express";
import { requireAuth } from "../../middleware/ispAuth.js";
import { validateRequest } from "../../validators/validateRequest.js";
import MobileController from "./mobile.controller.js";
import {
  notificationIdParamsSchema,
  notificationsQuerySchema,
  oxyChatSchema,
} from "./mobile.validator.js";

const router = Router();

router.get("/locations", requireAuth, MobileController.listLocations);
router.post(
  "/oxy/chat",
  requireAuth,
  validateRequest({ body: oxyChatSchema }),
  MobileController.oxyChat,
);
router.get(
  "/notifications",
  requireAuth,
  validateRequest({ query: notificationsQuerySchema }),
  MobileController.listNotifications,
);
router.get(
  "/notifications/unread-count",
  requireAuth,
  MobileController.unreadNotificationsCount,
);
router.patch(
  "/notifications/read-all",
  requireAuth,
  MobileController.markAllNotificationsRead,
);
router.patch(
  "/notifications/:id/read",
  requireAuth,
  validateRequest({ params: notificationIdParamsSchema }),
  MobileController.markNotificationRead,
);

export default router;
