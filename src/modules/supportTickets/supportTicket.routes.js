import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/ispAuth.js";
import { validateRequest } from "../../validators/validateRequest.js";
import SupportTicketController from "./supportTicket.controller.js";
import {
  createSupportTicketReplySchema,
  createSupportTicketSchema,
  supportTicketIdParamsSchema,
  supportTicketQuerySchema,
  updateSupportTicketSchema,
} from "./supportTicket.validator.js";

const router = Router();

router.get("/", requireAuth, validateRequest({ query: supportTicketQuerySchema }), SupportTicketController.list);
router.get(
  "/:id",
  requireAuth,
  validateRequest({ params: supportTicketIdParamsSchema }),
  SupportTicketController.getById
);
router.post(
  "/",
  requireAuth,
  validateRequest({ body: createSupportTicketSchema }),
  SupportTicketController.create
);
router.post(
  "/:id/replies",
  requireAuth,
  validateRequest({ params: supportTicketIdParamsSchema, body: createSupportTicketReplySchema }),
  SupportTicketController.reply
);
router.patch(
  "/:id",
  requireAuth,
  requireRole("admin", "distributor", "support"),
  validateRequest({ params: supportTicketIdParamsSchema, body: updateSupportTicketSchema }),
  SupportTicketController.update
);

export default router;
