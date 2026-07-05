import { NotFoundError } from "../../utils/errors.js";
import { serializeDoc } from "../common/serializers.js";
import { CustomerNotification } from "./dashboard.models.js";

const toDto = (doc) => serializeDoc(doc);

class CustomerNotificationService {
  static async create({ customerId, type = "ticket_reply", title, body, ticketId = null }) {
    const trimmedTitle = String(title || "").trim();
    const trimmedBody = String(body || "").trim();
    if (!customerId || !trimmedTitle || !trimmedBody) return null;

    const item = await CustomerNotification().create({
      customerId: String(customerId),
      type,
      title: trimmedTitle,
      body: trimmedBody,
      ticketId: ticketId ? String(ticketId) : null,
      isRead: false,
    });
    return toDto(item);
  }

  static async notifyTicketReply({ customerId, ticketId, ticketNumber, message, staffName }) {
    const preview = String(message || "").trim().slice(0, 160);
    return CustomerNotificationService.create({
      customerId,
      type: "ticket_reply",
      title: `رد من ${staffName || "خدمة العملاء"}`,
      body: preview,
      ticketId,
    });
  }

  static async listForCustomer(customerId, { unreadOnly = false, limit = 50 } = {}) {
    const query = { customerId: String(customerId) };
    if (unreadOnly) query.isRead = false;

    const items = await CustomerNotification()
      .find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 100));

    return items.map(toDto);
  }

  static async unreadCount(customerId) {
    return CustomerNotification().countDocuments({
      customerId: String(customerId),
      isRead: false,
    });
  }

  static async markRead(id, customerId) {
    const item = await CustomerNotification().findOneAndUpdate(
      { _id: id, customerId: String(customerId) },
      { isRead: true },
      { new: true },
    );
    if (!item) throw new NotFoundError("Notification not found");
    return toDto(item);
  }

  static async markAllRead(customerId) {
    await CustomerNotification().updateMany(
      { customerId: String(customerId), isRead: false },
      { isRead: true },
    );
    return { success: true };
  }
}

export default CustomerNotificationService;
