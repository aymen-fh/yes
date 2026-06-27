import { ApiResponse } from "../../utils/apiResponse.js";
import { NotFoundError, ValidationError } from "../../utils/errors.js";
import { STAFF_ROLES } from "../../utils/roles.js";
import { findUserByIdAcrossRoles, getCustomerDomainModels } from "../../utils/roleModels.js";
import { serializeDoc, serializeDocs } from "../common/serializers.js";
import { toTicketMobileDto } from "../../utils/mobileDto.js";
import NotificationService from "../notifications/notification.service.js";
import SupportTicketService from "./supportTicket.service.js";

const ensureTicketRelations = async ({ customerId, subscriptionId }) => {
  const { Customer, Subscription } = getCustomerDomainModels();
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new NotFoundError("Customer not found");
  }

  if (!subscriptionId) {
    return { customer, subscription: null };
  }

  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw new NotFoundError("Subscription not found");
  }

  if (subscription.customerId.toString() !== customerId.toString()) {
    throw new ValidationError("Subscription does not belong to the selected customer");
  }

  return { customer, subscription };
};

const hydrateAssignedTo = async (ticket) => {
  if (!ticket?.assignedTo) return ticket;

  const assignee = await findUserByIdAcrossRoles(ticket.assignedTo, STAFF_ROLES);
  if (!assignee?.user) return ticket;

  ticket.assignedTo = {
    _id: assignee.user._id,
    fullName: assignee.user.fullName,
    customerCode: assignee.user.customerCode,
    role: assignee.user.role,
  };

  return ticket;
};

const hydrateAssignedList = async (tickets) => Promise.all(tickets.map(hydrateAssignedTo));

class SupportTicketController {
  static async list(req, res, next) {
    try {
      const { SupportTicket } = getCustomerDomainModels();
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
        SupportTicket.find(query)
          .populate("customerId", "fullName customerCode email status")
          .populate("subscriptionId", "subscriptionNumber status")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        SupportTicket.countDocuments(query),
      ]);
      const hydrated = await hydrateAssignedList(items);

      return ApiResponse.paginated(res, serializeDocs(hydrated), total, page, limit);
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { SupportTicket } = getCustomerDomainModels();
      const ticket = await SupportTicket.findById(req.params.id)
        .populate("customerId", "fullName customerCode email status")
        .populate("subscriptionId", "subscriptionNumber status");

      if (!ticket) {
        throw new NotFoundError("Support ticket not found");
      }

      SupportTicketService.ensureUserCanReadTicket(req.user, ticket);

      const hydrated = await hydrateAssignedTo(ticket);
      return ApiResponse.success(res, toTicketMobileDto(hydrated));
    } catch (error) {
      return next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const { SupportTicket } = getCustomerDomainModels();
      const targetCustomerId = req.user.role === "customer" ? req.user.id : req.body.customerId || req.user.id;

      const { customer } = await ensureTicketRelations({
        customerId: targetCustomerId,
        subscriptionId: req.body.subscriptionId,
      });

      const ticketNumber = await SupportTicketService.createTicketNumber();

      const ticket = await SupportTicket.create({
        ticketNumber,
        customerId: targetCustomerId,
        subscriptionId: req.body.subscriptionId || null,
        subject: req.body.subject,
        description: req.body.description,
        category: req.body.category,
        priority: req.body.priority,
        dashboardMeta: req.body.dashboardMeta || undefined,
      });

      const item = await SupportTicket.findById(ticket._id)
        .populate("customerId", "fullName customerCode email status")
        .populate("subscriptionId", "subscriptionNumber status");

      const hydrated = await hydrateAssignedTo(item);

      await NotificationService.notifySupportTicketCreated({
        customer: serializeDoc(customer),
        ticket: serializeDoc(hydrated),
      });

      return ApiResponse.created(res, toTicketMobileDto(hydrated), "Support ticket created successfully");
    } catch (error) {
      return next(error);
    }
  }

  static async reply(req, res, next) {
    try {
      const { SupportTicket } = getCustomerDomainModels();
      const ticket = await SupportTicket.findById(req.params.id)
        .populate("customerId", "fullName customerCode email status")
        .populate("subscriptionId", "subscriptionNumber status");

      if (!ticket) {
        throw new NotFoundError("Support ticket not found");
      }

      SupportTicketService.ensureUserCanReadTicket(req.user, ticket);

      await SupportTicketService.appendReply({
        ticket,
        actor: req.user,
        message: req.body.message,
      });

      const updatedTicket = await SupportTicket.findById(ticket._id)
        .populate("customerId", "fullName customerCode email status")
        .populate("subscriptionId", "subscriptionNumber status");

      const hydrated = await hydrateAssignedTo(updatedTicket);
      return ApiResponse.success(res, toTicketMobileDto(hydrated), "Reply added to ticket");
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { SupportTicket } = getCustomerDomainModels();
      const existing = await SupportTicket.findById(req.params.id);
      if (!existing) {
        throw new NotFoundError("Support ticket not found");
      }

      const payload = { ...req.body };

      if (payload.assignedTo) {
        const assignee = await findUserByIdAcrossRoles(payload.assignedTo, STAFF_ROLES);
        if (!assignee?.user || !STAFF_ROLES.includes(assignee.user.role)) {
          throw new ValidationError("assignedTo must reference a staff account");
        }
      }

      if (payload.status === "resolved" && !existing.resolvedAt) {
        payload.resolvedAt = new Date();
      }

      if (payload.status === "closed" && !existing.closedAt) {
        payload.closedAt = new Date();
      }

      if (payload.dashboardMeta) {
        const existingMeta =
          typeof existing.dashboardMeta?.toObject === "function"
            ? existing.dashboardMeta.toObject()
            : { ...(existing.dashboardMeta ?? {}) };
        payload.dashboardMeta = { ...existingMeta, ...payload.dashboardMeta };
      }

      const updated = await SupportTicket.findByIdAndUpdate(req.params.id, payload, { new: true })
        .populate("customerId", "fullName customerCode email status")
        .populate("subscriptionId", "subscriptionNumber status");

      const hydrated = await hydrateAssignedTo(updated);
      return ApiResponse.success(res, serializeDoc(hydrated), "Support ticket updated");
    } catch (error) {
      return next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      const { SupportTicket } = getCustomerDomainModels();
      const ticket = await SupportTicket.findByIdAndDelete(req.params.id);
      if (!ticket) {
        throw new NotFoundError("Support ticket not found");
      }
      return ApiResponse.success(res, null, "Support ticket deleted");
    } catch (error) {
      return next(error);
    }
  }
}

export default SupportTicketController;
