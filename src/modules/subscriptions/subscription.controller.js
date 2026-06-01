import { ApiResponse } from "../../utils/apiResponse.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../utils/errors.js";
import { getCustomerDomainModels } from "../../utils/roleModels.js";
import { createReadableCode, serializeDoc, serializeDocs } from "../common/serializers.js";
import PaymentService from "../payments/payment.service.js";
import SubscriptionService from "./subscription.service.js";

const ensurePlanAndCustomer = async ({ planId, customerId }) => {
  const { Plan, Customer } = getCustomerDomainModels();
  const [plan, customer] = await Promise.all([
    Plan.findById(planId),
    Customer.findById(customerId),
  ]);

  if (!plan) {
    throw new NotFoundError("Plan not found");
  }

  if (!customer) {
    throw new NotFoundError("Customer not found");
  }

  return { plan, customer };
};

const toSubscriptionDto = (subscription) => serializeDoc(subscription);

const getDomainModels = () => getCustomerDomainModels();

const createSubscriptionNumber = async () => {
  const { Subscription } = getCustomerDomainModels();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const number = createReadableCode("SUB");
    const exists = await Subscription.exists({ subscriptionNumber: number });
    if (!exists) return number;
  }

  return `${createReadableCode("SUB")}-${Date.now().toString().slice(-4)}`;
};

const ensureUserCanReadSubscription = (reqUser, subscription) => {
  if (reqUser.role !== "customer") return;
  if (subscription.customerId?._id?.toString?.() !== reqUser.id) {
    throw new ForbiddenError("You can only view your own subscription");
  }
};

const toTransactionItem = (payment) => {
  const amount = typeof payment.totalAmount === "number" ? payment.totalAmount : payment.amount;
  return {
    id: payment._id?.toString?.() ?? payment.id,
    subscriptionId: payment.subscriptionId?._id?.toString?.() ||
      payment.subscriptionId?.toString?.(),
    type: payment.method || "payment",
    amount: amount || 0,
    status: payment.status || "pending",
    createdAt: payment.createdAt,
  };
};

class SubscriptionController {
  static async list(req, res, next) {
    try {
      const { Subscription } = getDomainModels();
      await SubscriptionService.expireDueSubscriptions();

      const { page, limit, customerId, status } = req.query;
      const query = {};

      if (req.user.role === "customer") {
        query.customerId = req.user.id;
      } else if (customerId) {
        query.customerId = customerId;
      }

      if (status) {
        query.status = status;
      }

      const [items, total] = await Promise.all([
        Subscription.find(query)
          .populate("customerId", "fullName customerCode email")
          .populate("planId", "name code speedMbps dataLimitGb monthlyPrice")
          .populate("deviceId", "serialNumber model status ipAddress")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Subscription.countDocuments(query),
      ]);

      return ApiResponse.paginated(res, serializeDocs(items), total, page, limit);
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { Subscription } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id)
        .populate("customerId", "fullName customerCode email status")
        .populate("planId", "name code speedMbps dataLimitGb monthlyPrice vatPercent")
        .populate("deviceId", "serialNumber model status firmwareVersion ipAddress");

      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      await SubscriptionService.ensureNotExpired(subscription);
      ensureUserCanReadSubscription(req.user, subscription);

      return ApiResponse.success(res, toSubscriptionDto(subscription));
    } catch (error) {
      return next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const { Subscription, Device, Payment } = getDomainModels();
      const { plan } = await ensurePlanAndCustomer(req.body);

      const startedAt = req.body.startedAt || new Date();
      const durationMonths = req.body.durationMonths || 1;
      const nextBillingDate = req.body.nextBillingDate
        ? new Date(req.body.nextBillingDate)
        : SubscriptionService.addMonthsSafe(startedAt, durationMonths);

      const createPayload = {
        ...req.body,
        startedAt,
        nextBillingDate,
      };
      delete createPayload.durationMonths;

      const subscriptionNumber = await createSubscriptionNumber();

      const subscription = await Subscription.create({
        subscriptionNumber,
        ...createPayload,
      });

      if (req.body.deviceId) {
        await Device.findByIdAndUpdate(req.body.deviceId, {
          customerId: req.body.customerId,
          subscriptionId: subscription._id,
          status: "online",
          lastSeenAt: new Date(),
        });
      }

      const item = await Subscription.findById(subscription._id)
        .populate("customerId", "fullName customerCode email")
        .populate("planId", "name code speedMbps dataLimitGb monthlyPrice vatPercent")
        .populate("deviceId", "serialNumber model status ipAddress");

      const activationInvoice = await SubscriptionService.createActivationInvoiceIfNeeded({
        subscription: item,
        plan: item.planId || plan,
      });

      if (activationInvoice) {
        const invoiceItem = await Payment.findById(activationInvoice._id)
          .populate("customerId", "fullName customerCode email")
          .populate("subscriptionId", "subscriptionNumber status");

        return ApiResponse.created(
          res,
          {
            subscription: toSubscriptionDto(item),
            invoice: serializeDoc(invoiceItem),
          },
          "Subscription created and activation invoice generated"
        );
      }

      return ApiResponse.created(res, toSubscriptionDto(item), "Subscription created successfully");
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { Subscription, Device, Payment } = getDomainModels();
      const existing = await Subscription.findById(req.params.id);
      if (!existing) {
        throw new NotFoundError("Subscription not found");
      }

      if (req.body.planId || req.body.customerId) {
        await ensurePlanAndCustomer({
          planId: req.body.planId || existing.planId,
          customerId: req.body.customerId || existing.customerId,
        });
      }

      const updated = await Subscription.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      })
        .populate("customerId", "fullName customerCode email")
        .populate("planId", "name code speedMbps dataLimitGb monthlyPrice vatPercent")
        .populate("deviceId", "serialNumber model status ipAddress");

      if (req.body.deviceId) {
        await Device.findByIdAndUpdate(req.body.deviceId, {
          customerId: updated.customerId?._id || updated.customerId,
          subscriptionId: updated._id,
          status: "online",
          lastSeenAt: new Date(),
        });
      }

      let activationInvoice = null;
      if (existing.status !== "active" && updated.status === "active") {
        activationInvoice = await SubscriptionService.createActivationInvoiceIfNeeded({
          subscription: updated,
          plan: updated.planId,
        });
      }

      if (activationInvoice) {
        const invoiceItem = await Payment.findById(activationInvoice._id)
          .populate("customerId", "fullName customerCode email")
          .populate("subscriptionId", "subscriptionNumber status");

        return ApiResponse.success(
          res,
          {
            subscription: toSubscriptionDto(updated),
            invoice: serializeDoc(invoiceItem),
          },
          "Subscription activated and invoice generated"
        );
      }

      return ApiResponse.success(res, toSubscriptionDto(updated), "Subscription updated");
    } catch (error) {
      return next(error);
    }
  }

  static async usage(req, res, next) {
    try {
      const { Subscription } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id)
        .populate("customerId", "fullName customerCode")
        .populate("planId", "name dataLimitGb speedMbps");

      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      await SubscriptionService.ensureNotExpired(subscription);
      ensureUserCanReadSubscription(req.user, subscription);

      const dataLimitGb = subscription.planId?.dataLimitGb || 0;
      const usageGb = subscription.dataUsageGb || 0;
      const usagePercent = dataLimitGb > 0 ? Math.min(100, Math.round((usageGb / dataLimitGb) * 100)) : 0;

      return ApiResponse.success(res, {
        id: subscription._id.toString(),
        subscriptionNumber: subscription.subscriptionNumber,
        customer: subscription.customerId,
        plan: subscription.planId,
        usageGb,
        dataLimitGb,
        remainingGb: Math.max(0, dataLimitGb - usageGb),
        usagePercent,
        status: subscription.status,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async dashboard(req, res, next) {
    try {
      const { Subscription, Payment } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id)
        .populate("customerId", "fullName customerCode email")
        .populate("planId", "name code speedMbps dataLimitGb monthlyPrice");

      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      await SubscriptionService.ensureNotExpired(subscription);
      ensureUserCanReadSubscription(req.user, subscription);

      const dataLimitGb = subscription.planId?.dataLimitGb || 0;
      const usageGb = subscription.dataUsageGb || 0;
      const remainingGb = Math.max(0, dataLimitGb - usageGb);

      const periodEnd = subscription.nextBillingDate || new Date();
      const periodStart = SubscriptionService.addMonthsSafe(periodEnd, -1);

      const payments = await Payment.find({
        subscriptionId: subscription._id,
      })
        .sort({ createdAt: -1 })
        .limit(3);

      return ApiResponse.success(res, {
        serviceStatus: subscription.status,
        nextBillingDate: subscription.nextBillingDate,
        usage: {
          subscriptionId: subscription._id.toString(),
          isUnlimited: dataLimitGb <= 0,
          periodStart,
          periodEnd,
          quotaTotalGb: dataLimitGb,
          consumedGb: usageGb,
          remainingGb,
        },
        latestTransactions: payments.map(toTransactionItem),
      });
    } catch (error) {
      return next(error);
    }
  }

  static async transactions(req, res, next) {
    try {
      const { Subscription, Payment } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id);
      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      ensureUserCanReadSubscription(req.user, subscription);

      const payments = await Payment.find({
        subscriptionId: subscription._id,
      }).sort({ createdAt: -1 });

      return ApiResponse.success(res, payments.map(toTransactionItem));
    } catch (error) {
      return next(error);
    }
  }

  static async plans(req, res, next) {
    try {
      const { Subscription, Plan } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id);
      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      ensureUserCanReadSubscription(req.user, subscription);

      const plans = await Plan.find({ isActive: true }).sort({ monthlyPrice: 1 });
      return ApiResponse.success(res, serializeDocs(plans));
    } catch (error) {
      return next(error);
    }
  }

  static async switchPlan(req, res, next) {
    try {
      const { Subscription, Plan } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id)
        .populate("planId", "name code speedMbps dataLimitGb monthlyPrice");

      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      ensureUserCanReadSubscription(req.user, subscription);

      const targetPlan = await Plan.findById(req.body.targetPlanId);
      if (!targetPlan) {
        throw new NotFoundError("Plan not found");
      }

      subscription.planId = targetPlan._id;
      await subscription.save();

      const refreshed = await Subscription.findById(subscription._id)
        .populate("customerId", "fullName customerCode email status")
        .populate("planId", "name code speedMbps dataLimitGb monthlyPrice vatPercent");

      return ApiResponse.success(res, toSubscriptionDto(refreshed), "Plan updated");
    } catch (error) {
      return next(error);
    }
  }

  static async submitTopup(req, res, next) {
    try {
      const { Subscription } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id)
        .populate("customerId", "fullName customerCode email status")
        .populate("planId", "name code speedMbps dataLimitGb monthlyPrice vatPercent");

      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      ensureUserCanReadSubscription(req.user, subscription);

      const digits = String(req.body.scratchCode || "").match(/\d+/g);
      const amount = digits ? Number(digits.join("")) : 0;

      if (!amount || Number.isNaN(amount)) {
        throw new ValidationError("Invalid scratch code value");
      }

      const now = new Date();
      const invoice = await PaymentService.createSubscriptionInvoice({
        subscription,
        plan: subscription.planId,
        months: 1,
        paymentMethod: "wallet",
        markAsPaid: true,
        currency: "EGP",
        note: `Topup via scratch code ${req.body.scratchCode}`,
        periodStart: now,
        periodEnd: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        dueDate: now,
      });

      // Override invoice amounts with topup value
      invoice.amount = amount;
      invoice.totalAmount = amount;
      invoice.vatAmount = 0;
      await invoice.save();

      return ApiResponse.success(res, {
        id: invoice._id.toString(),
        subscriptionId: subscription._id.toString(),
        amount: invoice.totalAmount,
        status: invoice.status,
        receiptRef: invoice.invoiceNumber,
        createdAt: invoice.createdAt,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async renew(req, res, next) {
    try {
      const { months, paymentMethod, markAsPaid, currency, note } = req.body;

      const { Subscription, Payment } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id)
        .populate("customerId", "fullName customerCode email status")
        .populate("planId", "name code speedMbps dataLimitGb monthlyPrice vatPercent");

      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      await SubscriptionService.ensureNotExpired(subscription);
      ensureUserCanReadSubscription(req.user, subscription);

      const plan = subscription.planId;
      if (!plan) {
        throw new NotFoundError("Plan not found for this subscription");
      }

      const { payment } = await SubscriptionService.renewSubscription({
        subscription,
        months,
        paymentMethod,
        markAsPaid,
        currency,
        note,
      });

      const refreshedSubscription = await Subscription.findById(subscription._id)
        .populate("customerId", "fullName customerCode email status")
        .populate("planId", "name code speedMbps dataLimitGb monthlyPrice vatPercent")
        .populate("deviceId", "serialNumber model status ipAddress");

      const paymentItem = await Payment.findById(payment._id)
        .populate("customerId", "fullName customerCode email")
        .populate("subscriptionId", "subscriptionNumber status");

      await SubscriptionService.notifyRenewed({
        subscription: refreshedSubscription,
        invoice: paymentItem,
      });

      return ApiResponse.success(
        res,
        {
          subscription: toSubscriptionDto(refreshedSubscription),
          invoice: serializeDoc(paymentItem),
        },
        "Subscription renewed successfully"
      );
    } catch (error) {
      return next(error);
    }
  }
  static async transactions(req, res, next) {
    try {
      const { Payment } = getDomainModels();
      const items = await Payment.find({ subscriptionId: req.params.id }).sort({ createdAt: -1 });
      return ApiResponse.success(res, serializeDocs(items));
    } catch (error) {
      return next(error);
    }
  }

  static async topup(req, res, next) {
    try {
      const { scratchCode } = req.body;
      const { Subscription, Payment } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id);
      if (!subscription) throw new NotFoundError("Subscription not found");

      const payment = await Payment.create({
        subscriptionId: subscription._id,
        customerId: subscription.customerId,
        invoiceNumber: await PaymentService.createInvoiceNumber(),
        amount: 100,
        totalAmount: 100,
        currency: "LYD",
        status: "paid",
        paidAt: new Date(),
        paymentMethod: "scratch_card",
        type: "topup"
      });
      return ApiResponse.success(res, serializeDoc(payment));
    } catch (error) {
      return next(error);
    }
  }

  static async plans(req, res, next) {
    try {
      const { Plan } = getDomainModels();
      const items = await Plan.find({ status: "active" });
      return ApiResponse.success(res, serializeDocs(items));
    } catch (error) {
      return next(error);
    }
  }

  static async switchPlan(req, res, next) {
    try {
      const { targetPlanId } = req.body;
      const { Subscription } = getDomainModels();
      const subscription = await Subscription.findByIdAndUpdate(
        req.params.id,
        { planId: targetPlanId },
        { new: true }
      ).populate("planId");
      return ApiResponse.success(res, toSubscriptionDto(subscription));
    } catch (error) {
      return next(error);
    }
  }

  static async tickets(req, res, next) {
    try {
      const { SupportTicket } = getDomainModels();
      const items = await SupportTicket.find({ subscriptionId: req.params.id }).sort({ createdAt: -1 });
      return ApiResponse.success(res, serializeDocs(items));
    } catch (error) {
      return next(error);
    }
  }

  static async createTicket(req, res, next) {
    try {
      const { Subscription, SupportTicket } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id);
      if (!subscription) throw new NotFoundError("Subscription not found");
      const ticket = await SupportTicket.create({
        subscriptionId: req.params.id,
        customerId: subscription.customerId,
        subject: req.body.subject,
        description: req.body.description,
        status: "open",
        priority: "medium"
      });
      return ApiResponse.success(res, serializeDoc(ticket));
    } catch (error) {
      return next(error);
    }
  }
}

export default SubscriptionController;
