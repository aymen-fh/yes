import "dotenv/config";
import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import authRoute from "./modules/auth/auth.routes.js";
import customerRoute from "./modules/customers/customer.routes.js";
import planRoute from "./modules/plans/plan.routes.js";
import subscriptionRoute from "./modules/subscriptions/subscription.routes.js";
import paymentRoute from "./modules/payments/payment.routes.js";
import deviceRoute from "./modules/devices/device.routes.js";
import supportTicketRoute from "./modules/supportTickets/supportTicket.routes.js";
import adminRoute from "./modules/admin/admin.routes.js";
import { corsOptions } from "./config/cors.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requestId } from "./middleware/requestId.js";
import { sanitizeRequest } from "./middleware/sanitizeRequest.js";
import logger, { morganStream } from "./utils/logger.js";
import { swaggerSpec } from "./config/swagger.js";
import { getDatabaseStatus, isDatabaseReady } from "./config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminReactDistPath = path.resolve(__dirname, "../../frontend/dist");
const adminReactIndexPath = path.join(adminReactDistPath, "index.html");
const adminReactAssetsPath = path.join(adminReactDistPath, "assets");
const adminReactRoute = "/admin-react";
const adminReactRoutePattern = /^\/admin-react(?:\/.*)?$/;
const hasAdminReactBuild = fs.existsSync(adminReactIndexPath);

const app = express();

// ─── Core middleware ─────────────────────────────────────────────────────────
app.use(requestId);
app.use((req, res, next) => {
  console.log("--------------------------------------------------");
  console.log(`📡 NEW REQUEST: ${req.method} ${req.originalUrl}`);
  console.log("--------------------------------------------------");
  logger.info(`🔍 Incoming Request: ${req.method} ${req.originalUrl}`);
  next();
});
app.use(helmet());
app.use(cors(corsOptions));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// ─── Rate limiting ───────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === "development";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev, // ⬅ no rate limiting in dev
});



if (!isDev) app.use(limiter);
app.use(express.json({ limit: "10mb" }));
app.use(sanitizeRequest); // NoSQL injection protection
app.use(morgan("combined", { stream: morganStream }));

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    name: "Oxygen ISP Backend",
    message: "Oxygen backend is running.",
    dashboards: {
      legacy: "/admin",
      react: adminReactRoute,
    },
  });
});

app.get("/health", (_req, res) => {
  const dbStatus = getDatabaseStatus();

  res.status(dbStatus.connected ? 200 : 503).json({
    success: dbStatus.connected,
    status: dbStatus.connected ? "ok" : "degraded",
    database: dbStatus,
  });
});

app.get("/api/v1/health", (_req, res) => {
  const dbStatus = getDatabaseStatus();

  res.status(dbStatus.connected ? 200 : 503).json({
    success: dbStatus.connected,
    status: dbStatus.connected ? "ok" : "degraded",
    service: "oxygen-api",
    database: dbStatus,
  });
});

// ─── API Documentation ────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  logger.info("📚 Swagger docs available at /api-docs");
}

// ─── Versioned Routes ─────────────────────────────────────────────────────────
app.use("/api/v1", (req, res, next) => {
  if (isDatabaseReady()) {
    return next();
  }

  return res.status(503).json({
    success: false,
    message: "Database is unavailable. The server is running in degraded mode and will retry automatically.",
    database: getDatabaseStatus(),
  });
});

app.use("/api/v1/auth", authRoute);
app.use("/api/v1/customers", customerRoute);
app.use("/api/v1/plans", planRoute);
app.use("/api/v1/subscriptions", subscriptionRoute);
app.use("/api/v1/payments", paymentRoute);
app.use("/api/v1/devices", deviceRoute);
app.use("/api/v1/support-tickets", supportTicketRoute);
app.use("/api/v1/tickets", supportTicketRoute); // Alias for App

// Legacy/compat alias to support /api base path used by the mobile app.
app.use("/api/auth", authRoute);
app.use("/api/customers", customerRoute);
app.use("/api/plans", planRoute);
app.use("/api/subscriptions", subscriptionRoute);
app.use("/api/payments", paymentRoute);
app.use("/api/devices", deviceRoute);
app.use("/api/support-tickets", supportTicketRoute);
app.use("/api/tickets", supportTicketRoute);
app.use("/admin", adminRoute);

if (hasAdminReactBuild) {
  // Compatibility alias for cached pages that still reference /assets/* paths.
  app.use("/assets", express.static(adminReactAssetsPath, { index: false }));
  app.use(adminReactRoute, express.static(adminReactDistPath, { index: false }));

  app.get(adminReactRoutePattern, (req, res, next) => {
    const hasFileExtension = Boolean(path.extname(req.path || ""));
    const acceptsHtml = (req.headers.accept || "").includes("text/html");

    if (hasFileExtension || !acceptsHtml) {
      return next();
    }

    res.setHeader("Cache-Control", "no-store");
    res.sendFile(adminReactIndexPath);
  });

  logger.info(`🧭 React admin dashboard served at ${adminReactRoute}`);
} else {
  app.get(adminReactRoutePattern, (_req, res) => {
    res.status(503).json({
      success: false,
      message: "Admin React build was not found. Run `npm run build:admin-react` first.",
      route: adminReactRoute,
      expectedFile: adminReactIndexPath,
    });
  });

  logger.warn(
    `Admin React build missing at ${adminReactIndexPath}. Route ${adminReactRoute} will return 503 until built.`
  );
}

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
