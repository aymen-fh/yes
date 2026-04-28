import { serializeDoc } from "../common/serializers.js";
import NotificationService from "../notifications/notification.service.js";
import PaymentService from "../payments/payment.service.js";
import SubscriptionModel from "./subscription.model.js";

class SubscriptionService {
  static addMonthsSafe(dateInput, monthsToAdd) {
    const source = new Date(dateInput);
    const target = new Date(source);
    target.setMonth(target.getMonth() + monthsToAdd);

    if (target.getDate() < source.getDate()) {
      target.setDate(0);
    }

    return target;
  }

  static async expireDueSubscriptions() {
    const now = new Date();

    const result = await SubscriptionModel.updateMany(
      {
        status: { $in: ["active", "pending"] },
        nextBillingDate: { $lte: now },
      },
      {
        $set: {
          status: "cancelled",
        },
      }
    );

    return result;
  }

  static async ensureNotExpired(subscription) {
    if (!subscription?.nextBillingDate) {
      return subscription;
    }

    if (subscription.status === "cancelled") {
      return subscription;
    }

    if (subscription.nextBillingDate <= new Date()) {
      subscription.status = "cancelled";
      await subscription.save();
    }

    return subscription;
  }

  static async createActivationInvoiceIfNeeded({ subscription, plan }) {
    if (subscription.status !== "active") {
      return null;
    }

    const periodStart = subscription.startedAt || new Date();
    const periodEnd = new Date(subscription.nextBillingDate.getTime() - 1000);

    return PaymentService.createSubscriptionInvoice({
      subscription,
      plan,
      months: 1,
      paymentMethod: "cash",
      markAsPaid: false,
      currency: "EGP",
      note: "Activation invoice",
      periodStart,
      periodEnd,
      dueDate: subscription.nextBillingDate,
    });
  }

  static async renewSubscription({
    subscription,
    months = 1,
    paymentMethod = "card",
    markAsPaid = true,
    currency = "EGP",
    note,
  }) {
    const plan = subscription.planId;
    const now = new Date();

    const currentAnchor = subscription.nextBillingDate && subscription.nextBillingDate > now
      ? new Date(subscription.nextBillingDate)
      : now;
    const nextBillingDate = SubscriptionService.addMonthsSafe(currentAnchor, months);

    const payment = await PaymentService.createSubscriptionInvoice({
      subscription,
      plan,
      months,
      paymentMethod,
      markAsPaid,
      currency,
      note: note || `Subscription renewal for ${months} month(s)`,
      periodStart: currentAnchor,
      periodEnd: new Date(nextBillingDate.getTime() - 1000),
      dueDate: markAsPaid ? now : nextBillingDate,
    });

    subscription.status = "active";
    subscription.nextBillingDate = nextBillingDate;
    await subscription.save();

    return {
      subscription,
      payment,
    };
  }

  static async notifyRenewed({ subscription, invoice }) {
    await NotificationService.notifySubscriptionRenewed({
      customer: serializeDoc(subscription.customerId),
      subscription: serializeDoc(subscription),
      invoice: serializeDoc(invoice),
    });
  }
}

export default SubscriptionService;
