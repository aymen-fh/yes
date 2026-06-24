import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/ispAuth.js";
import DashboardController from "./dashboard.controller.js";

const router = Router();
const adminOnly = [requireAuth, requireRole("admin", "system_engineer")];
const staffOnly = [requireAuth, requireRole("admin", "system_engineer", "agent", "customer_service", "tech_support")];

router.get("/bootstrap", ...adminOnly, DashboardController.bootstrap);

router.post("/customers", ...adminOnly, DashboardController.createCustomer);
router.patch("/customers/:id", ...adminOnly, DashboardController.updateCustomer);
router.delete("/customers/:id", ...adminOnly, DashboardController.deleteCustomer);

router.post("/agents", ...adminOnly, DashboardController.createAgent);
router.patch("/agents/:id", ...adminOnly, DashboardController.updateAgent);
router.delete("/agents/:id", ...adminOnly, DashboardController.deleteAgent);
router.post("/agents/:id/topup", ...adminOnly, DashboardController.topUpAgent);

router.patch("/engineers/:id", ...adminOnly, DashboardController.updateEngineer);

router.post("/users", ...adminOnly, DashboardController.createStaffUser);
router.patch("/users/:id", ...adminOnly, DashboardController.updateStaffUser);
router.delete("/users/:id", ...adminOnly, DashboardController.deleteStaffUser);

router.post("/cards/generate", ...adminOnly, DashboardController.generateCards);
router.delete("/cards/:id", ...adminOnly, DashboardController.deleteCard);

router.post("/reports", requireAuth, DashboardController.createReport);
router.post("/audit-logs", requireAuth, DashboardController.createAuditLog);
router.get("/permissions", ...staffOnly, DashboardController.listPermissions);
router.put("/permissions", ...adminOnly, DashboardController.upsertPermissions);

router.post("/requests", requireAuth, DashboardController.createRequest);
router.patch("/requests/:id", ...adminOnly, DashboardController.updateRequest);

router.post("/messages", requireAuth, DashboardController.createMessage);
router.patch("/messages/:id/read", requireAuth, DashboardController.markMessageRead);

export default router;
