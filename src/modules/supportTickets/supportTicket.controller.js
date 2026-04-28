import { ApiResponse } from "../../utils/apiResponse.js";
import { NotFoundError, ValidationError } from "../../utils/errors.js";
import { serializeDoc, serializeDocs } from "../common/serializers.js";
import CustomerModel from "../customers/customer.model.js";
import SubscriptionModel from "../subscriptions/subscription.model.js";
import NotificationService from "../notifications/notification.service.js";
import SupportTicketService from "./supportTicket.service.js";
import SupportTicketModel from "./supportTicket.model.js";

const ensureTicketRelations = async ({ customerId, subscriptionId }) => {
  const customer = await CustomerModel.findById(customerId);
  if (!customer) {
    throw new NotFoundError("Customer not found");
  }

  if (!subscriptionId) {
    return { customer, subscription: null };
  }

  const subscription = await SubscriptionModel.findById(subscriptionId);
  if (!subscription) {
    throw new NotFoundError("Subscription not found");
  }

  if (subscription.customerId.toString() !== customerId.toString()) {
    throw new ValidationError("Subscription does not belong to the selected customer");
  }

  return { customer, subscription };
};

class SupportTicketController {
  static async list(req, res, next) {
    try {
      const { page, limit, customerId, status, priority } = req.query;
      const query = {};

      if (req.user.role === "customer") {
        query.customerId = req.user.id;
      } else if (customerId) {
        query.customerId = customerId;
      }

      if (status) {
        query.status = status;
      }

      if (priority) {
        query.priority = priority;
      }

      const [items, total] = await Promise.all([
        SupportTicketModel.find(query)
          .populate("customerId", "fullName customerCode email status")
          .populate("subscriptionId", "subscriptionNumber status")
          .populate("assignedTo", "fullName customerCode role")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        SupportTicketModel.countDocuments(query),
      ]);

      return ApiResponse.paginated(res, serializeDocs(items), total, page, limit);
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const ticket = await SupportTicketModel.findById(req.params.id)
        .populate("customerId", "fullName customerCode email status")
        .populate("subscriptionId", "subscriptionNumber status")
        .populate("assignedTo", "fullName customerCode role");

      if (!ticket) {
        throw new NotFoundError("Support ticket not found");
      }

      SupportTicketService.ensureUserCanReadTicket(req.user, ticket);

      return ApiResponse.success(res, serializeDoc(ticket));
    } catch (error) {
      return next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const targetCustomerId = req.user.role === "customer" ? req.user.id : req.body.customerId || req.user.id;

      const { customer } = await ensureTicketRelations({
        customerId: targetCustomerId,
        subscriptionId: req.body.subscriptionId,
      });

      const ticketNumber = await SupportTicketService.createTicketNumber();

      const ticket = await SupportTicketModel.create({
        ticketNumber,
        customerId: targetCustomerId,
        subscriptionId: req.body.subscriptionId || null,
        subject: req.body.subject,
        description: req.body.description,
        category: req.body.category,
        priority: req.body.priority,
      });

      const item = await SupportTicketModel.findById(ticket._id)
        .populate("customerId", "fullName customerCode email status")
        .populate("subscriptionId", "subscriptionNumber status")
        .populate("assignedTo", "fullName customerCode role");

      await NotificationService.notifySupportTicketCreated({
        customer: serializeDoc(customer),
        ticket: serializeDoc(item),
      });

      return ApiResponse.created(res, serializeDoc(item), "Support ticket created successfully");
    } catch (error) {
      return next(error);
    }
  }

  static async reply(req, res, next) {
    try {
      const ticket = await SupportTicketModel.findById(req.params.id)
        .populate("customerId", "fullName customerCode email status")
        .populate("subscriptionId", "subscriptionNumber status")
        .populate("assignedTo", "fullName customerCode role");

      if (!ticket) {
        throw new NotFoundError("Support ticket not found");
      }

      SupportTicketService.ensureUserCanReadTicket(req.user, ticket);

      await SupportTicketService.appendReply({
        ticket,
        actor: req.user,
        message: req.body.message,
      });

      const updatedTicket = await SupportTicketModel.findById(ticket._id)
        .populate("customerId", "fullName customerCode email status")
        .populate("subscriptionId", "subscriptionNumber status")
        .populate("assignedTo", "fullName customerCode role");

      return ApiResponse.success(res, serializeDoc(updatedTicket), "Reply added to ticket");
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const existing = await SupportTicketModel.findById(req.params.id);
      if (!existing) {
        throw new NotFoundError("Support ticket not found");
      }

      const payload = { ...req.body };

      if (payload.assignedTo) {
        const assignee = await CustomerModel.findById(payload.assignedTo);
        if (!assignee || !["admin", "distributor", "support"].includes(assignee.role)) {
          throw new ValidationError("assignedTo must reference a staff account");
        }
      }

      if (payload.status === "resolved" && !existing.resolvedAt) {
        payload.resolvedAt = new Date();
      }

      if (payload.status === "closed" && !existing.closedAt) {
        payload.closedAt = new Date();
      }

      const updated = await SupportTicketModel.findByIdAndUpdate(req.params.id, payload, { new: true })
        .populate("customerId", "fullName customerCode email status")
        .populate("subscriptionId", "subscriptionNumber status")
        .populate("assignedTo", "fullName customerCode role");

      return ApiResponse.success(res, serializeDoc(updated), "Support ticket updated");
    } catch (error) {
      return next(error);
    }
  }
}

export default SupportTicketController;
