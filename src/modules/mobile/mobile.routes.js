import { Router } from "express";
import { requireAuth } from "../../middleware/ispAuth.js";
import ServicePointController from "../servicePoints/servicePoint.controller.js";

const router = Router();

// Stable mobile-only endpoints (no :id conflicts).
router.get("/locations", requireAuth, ServicePointController.list);

export default router;
