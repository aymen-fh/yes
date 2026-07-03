import { Router } from "express";
import { requireAuth } from "../../middleware/ispAuth.js";
import { validateRequest } from "../../validators/validateRequest.js";
import MobileController from "./mobile.controller.js";
import { oxyChatSchema } from "./mobile.validator.js";

const router = Router();

router.get("/locations", requireAuth, MobileController.listLocations);
router.post(
  "/oxy/chat",
  requireAuth,
  validateRequest({ body: oxyChatSchema }),
  MobileController.oxyChat,
);

export default router;
