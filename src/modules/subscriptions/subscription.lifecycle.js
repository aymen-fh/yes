import { isDatabaseReady } from "../../config/db.js";
import logger from "../../utils/logger.js";
import SubscriptionService from "./subscription.service.js";

let lifecycleTimer = null;

export const startSubscriptionLifecycleJob = ({ intervalMs = 60_000 } = {}) => {
  if (lifecycleTimer) {
    return lifecycleTimer;
  }

  lifecycleTimer = setInterval(async () => {
    if (!isDatabaseReady()) {
      return;
    }

    try {
      const result = await SubscriptionService.expireDueSubscriptions();
      if ((result?.modifiedCount || 0) > 0) {
        logger.info(`[SubscriptionLifecycle] Expired subscriptions: ${result.modifiedCount}`);
      }
    } catch (error) {
      logger.error(`[SubscriptionLifecycle] Failed to expire subscriptions: ${error.message}`);
    }
  }, intervalMs);

  logger.info(`[SubscriptionLifecycle] Job started (every ${Math.round(intervalMs / 1000)}s)`);
  return lifecycleTimer;
};

export const stopSubscriptionLifecycleJob = () => {
  if (!lifecycleTimer) {
    return;
  }

  clearInterval(lifecycleTimer);
  lifecycleTimer = null;
  logger.info("[SubscriptionLifecycle] Job stopped");
};
