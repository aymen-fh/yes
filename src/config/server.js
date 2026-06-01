import "dotenv/config";
import app from "../app.js";
import db from "./db.js";
import { isDatabaseReady } from "./db.js";
import logger from "../utils/logger.js";
import { startSubscriptionLifecycleJob, stopSubscriptionLifecycleJob } from "../modules/subscriptions/subscription.lifecycle.js";

const port = process.env.PORT || 7000;

const reconnectIntervalMs = Number(process.env.DB_RETRY_INTERVAL_MS || 15000);
const subscriptionLifecycleIntervalMs = Number(process.env.SUBSCRIPTION_LIFECYCLE_INTERVAL_MS || 60000);

const startServer = async () => {
    try {
        await db({ throwOnError: false });

        const server = app.listen(port, "0.0.0.0", () => {
            logger.info(`🚀 Server running on port ${port} (0.0.0.0)`);
        });

        startSubscriptionLifecycleJob({ intervalMs: subscriptionLifecycleIntervalMs });

        // ─── Clean Shutdown ───────────────────────────────────────
        process.on("SIGTERM", () => {
            logger.info("SIGTERM received. Closing server...");
            stopSubscriptionLifecycleJob();
            server.close(() => {
                logger.info("Process terminated.");
                process.exit(0);
            });
        });

        if (!isDatabaseReady()) {
            logger.warn(
                `MongoDB is unavailable. Server will stay up in degraded mode and retry every ${reconnectIntervalMs / 1000}s.`
            );
        }

        setInterval(async () => {
            if (isDatabaseReady()) return;

            logger.info("Retrying MongoDB connection...");
            const connection = await db({ throwOnError: false });

            if (connection) {
                logger.info("MongoDB connection restored.");
            }
        }, reconnectIntervalMs);
    } catch (error) {
        logger.error(`Startup failed unexpectedly: ${error.message}`);
        process.exit(1);
    }
};

await startServer();
