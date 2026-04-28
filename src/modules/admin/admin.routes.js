import { Router } from "express";
import AdminController from "./admin.controller.js";

const router = Router();

router.get("/", AdminController.dashboard);

export default router;
