import logger from "../../utils/logger.js";

class NotificationService {
  static async send({ channel = "system", recipient = null, title, message, metadata = {} }) {
    // Integration adapter placeholder: replace with SMS/Email provider implementation.
    logger.info(
      `[Notification:${channel}] ${title} | recipient=${recipient || "n/a"} | message=${message} | metadata=${JSON.stringify(metadata)}`
    );

    return {
      channel,
      recipient,
      title,
      message,
      metadata,
      sentAt: new Date().toISOString(),
    };
  }

  static async notifySubscriptionRenewed({ customer, subscription, invoice }) {
    return NotificationService.send({
      channel: "email",
      recipient: customer?.email,
      title: "Subscription renewed",
      message: `Your subscription ${subscription?.subscriptionNumber || ""} was renewed successfully. Invoice: ${invoice?.invoiceNumber || "-"}`,
      metadata: {
        customerId: customer?.id || customer?._id?.toString?.(),
        subscriptionId: subscription?.id || subscription?._id?.toString?.(),
        invoiceNumber: invoice?.invoiceNumber,
      },
    });
  }

  static async notifySupportTicketCreated({ customer, ticket }) {
    return NotificationService.send({
      channel: "email",
      recipient: customer?.email,
      title: "Support ticket created",
      message: `Ticket ${ticket?.ticketNumber || "-"} has been created and is now being tracked.`,
      metadata: {
        customerId: customer?.id || customer?._id?.toString?.(),
        ticketId: ticket?.id || ticket?._id?.toString?.(),
        ticketNumber: ticket?.ticketNumber,
      },
    });
  }
}

export default NotificationService;
