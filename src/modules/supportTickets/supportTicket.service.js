import { ForbiddenError } from "../../utils/errors.js";
import { getCustomerDomainModels } from "../../utils/roleModels.js";
import { createReadableCode } from "../common/serializers.js";

class SupportTicketService {
  static normalizeAuthorRole(role) {
    if (role === "customer") return "customer";
    if (role === "agent") return "agent";
    if (role === "tech_support") return "tech_support";
    if (role === "customer_service") return "customer_service";
    if (role === "system_engineer") return "system_engineer";
    if (role === "admin") return "admin";
    return "support";
  }

  static async createTicketNumber() {
    const { SupportTicket } = getCustomerDomainModels();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const number = createReadableCode("TCK");
      const exists = await SupportTicket.exists({ ticketNumber: number });
      if (!exists) return number;
    }

    return `${createReadableCode("TCK")}-${Date.now().toString().slice(-4)}`;
  }

  static ensureUserCanReadTicket(reqUser, ticket) {
    if (reqUser.role !== "customer") return;

    const ticketCustomerId = ticket.customerId?._id?.toString?.() || ticket.customerId?.toString?.();
    if (ticketCustomerId !== reqUser.id) {
      throw new ForbiddenError("You can only access your own support tickets");
    }
  }

  static async appendReply({ ticket, actor, message }) {
    const trimmed = String(message || "").trim();
    if (!trimmed) {
      return ticket;
    }

    ticket.replies = [
      ...(ticket.replies || []),
      {
        authorId: actor.id,
        authorRole: SupportTicketService.normalizeAuthorRole(actor.role),
        message: trimmed,
        createdAt: new Date(),
      },
    ];

    const staffRoles = [
      "admin",
      "agent",
      "tech_support",
      "customer_service",
      "system_engineer",
      "distributor",
      "support",
    ];
    if (staffRoles.includes(actor.role) && ticket.status === "open") {
      ticket.status = "in_progress";
    }

    await ticket.save();
    return ticket;
  }
}

export default SupportTicketService;
