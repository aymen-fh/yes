import { createReadableCode } from "../common/serializers.js";
import { getCustomerDomainModels } from "../../utils/roleModels.js";

const resolveId = (value) => value?._id || value;

class PaymentService {
  static async createInvoiceNumber() {
    const { Payment } = getCustomerDomainModels();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const invoice = createReadableCode("INV");
      const exists = await Payment.exists({ invoiceNumber: invoice });
      if (!exists) return invoice;
    }

    return `${createReadableCode("INV")}-${Date.now().toString().slice(-4)}`;
  }

  static buildSubscriptionInvoicePayload({
    subscription,
    plan,
    months = 1,
    paymentMethod = "card",
    markAsPaid = true,
    currency = "EGP",
    note,
    periodStart,
    periodEnd,
    dueDate,
  }) {
    const now = new Date();
    const safeMonths = Number.isInteger(months) && months > 0 ? months : 1;

    const amount = Number(((plan.monthlyPrice || 0) * safeMonths).toFixed(2));
    const vatAmount = Number(((amount * (plan.vatPercent || 0)) / 100).toFixed(2));
    const totalAmount = Number((amount + vatAmount).toFixed(2));

    return {
      customerId: resolveId(subscription.customerId),
      subscriptionId: resolveId(subscription),
      amount,
      vatAmount,
      totalAmount,
      currency: String(currency || "EGP").toUpperCase(),
      method: paymentMethod,
      status: markAsPaid ? "paid" : "pending",
      dueDate: dueDate || now,
      paidAt: markAsPaid ? now : null,
      periodStart,
      periodEnd,
      note: note || `Subscription invoice for ${safeMonths} month(s)`,
    };
  }

  static async createSubscriptionInvoice(input) {
    const { Payment } = getCustomerDomainModels();
    const payload = PaymentService.buildSubscriptionInvoicePayload(input);

    const existing = await Payment.findOne({
      subscriptionId: payload.subscriptionId,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
    });

    if (existing) {
      return existing;
    }

    const invoiceNumber = await PaymentService.createInvoiceNumber();
    const payment = await Payment.create({
      ...payload,
      invoiceNumber,
    });

    return payment;
  }
}

export default PaymentService;
