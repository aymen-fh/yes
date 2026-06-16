import { Router } from "express";
import { requireAuth } from "../../middleware/ispAuth.js";
import ServicePointController from "./servicePoint.controller.js";

const router = Router();

router.get("/", requireAuth, ServicePointController.list);

export default router;
