import { ApiResponse } from "../../utils/apiResponse.js";
import { ForbiddenError } from "../../utils/errors.js";
import { Roles } from "../../utils/roles.js";
import ServicePointController from "../servicePoints/servicePoint.controller.js";
import CustomerAiChatSyncService from "../dashboard/customerAiChatSync.service.js";
import CustomerNotificationService from "../dashboard/customerNotification.service.js";
import { chatWithOxy } from "./oxy.service.js";

const ensureCustomer = (req) => {
  if (req.user?.role !== Roles.CUSTOMER) {
    throw new ForbiddenError("Only customers can access mobile notifications");
  }
};

class MobileController {
  static async listLocations(req, res, next) {
    return ServicePointController.list(req, res, next);
  }

  static async oxyChat(req, res, next) {
    try {
      const { message, history, context } = req.body || {};
      const result = await chatWithOxy({
        message,
        history: Array.isArray(history) ? history : [],
        context: context && typeof context === "object" ? context : {},
      });

      if (req.user?.role === "customer" && req.user?.id) {
        CustomerAiChatSyncService.syncCustomerMessage({
          customerId: req.user.id,
          customerMessage: message,
          assistantMessage: result?.reply,
        }).catch((err) => {
          console.warn("[OXY] Failed to sync chat to customer service:", err?.message);
        });
      }

      return ApiResponse.success(res, result, "OXY reply");
    } catch (error) {
      return next(error);
    }
  }

  static async listNotifications(req, res, next) {
    try {
      ensureCustomer(req);
      const unreadOnly = req.query.unreadOnly === "true";
      const data = await CustomerNotificationService.listForCustomer(req.user.id, {
        unreadOnly,
        limit: Number(req.query.limit) || 50,
      });
      return ApiResponse.success(res, data, "Notifications loaded");
    } catch (error) {
      return next(error);
    }
  }

  static async unreadNotificationsCount(req, res, next) {
    try {
      ensureCustomer(req);
      const count = await CustomerNotificationService.unreadCount(req.user.id);
      return ApiResponse.success(res, { count }, "Unread notifications count");
    } catch (error) {
      return next(error);
    }
  }

  static async markNotificationRead(req, res, next) {
    try {
      ensureCustomer(req);
      const data = await CustomerNotificationService.markRead(req.params.id, req.user.id);
      return ApiResponse.success(res, data, "Notification marked as read");
    } catch (error) {
      return next(error);
    }
  }

  static async markAllNotificationsRead(req, res, next) {
    try {
      ensureCustomer(req);
      const data = await CustomerNotificationService.markAllRead(req.user.id);
      return ApiResponse.success(res, data, "All notifications marked as read");
    } catch (error) {
      return next(error);
    }
  }
}

export default MobileController;
