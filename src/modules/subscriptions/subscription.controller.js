import { ApiResponse } from "../../utils/apiResponse.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../utils/errors.js";
import { getCustomerDomainModels } from "../../utils/roleModels.js";
import { createReadableCode, serializeDoc, serializeDocs } from "../common/serializers.js";
import { toSubscriptionMobileDto, toTicketMobileDto, toPlanMobileDto, toSpeedTestDto } from "../../utils/mobileDto.js";
import { ensureUserCanReadSubscription } from "../../utils/subscriptionAccess.js";
import PaymentService from "../payments/payment.service.js";
import SubscriptionService from "./subscription.service.js";
import SupportTicketService from "../supportTickets/supportTicket.service.js";
import UsageService from "../usage/usage.service.js";
import SpeedTestService from "../speedTests/speedTest.service.js";
import AdvanceCreditService from "./advanceCredit.service.js";
import {
  parseTopupScratchCode,
  redeemTopupCouponCard,
  resolveTopupCouponCard,
} from "./topupCard.js";
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

const toSubscriptionDto = (subscription) => toSubscriptionMobileDto(subscription);

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

const toTransactionItem = (payment) => {
  const amount = typeof payment.totalAmount === "number" ? payment.totalAmount : payment.amount;
  const note = String(payment.note || "").toLowerCase();
  let type = payment.method || "payment";

  if (note.includes("topup") || note.includes("scratch")) {
    type = "topup";
  } else if (note.includes("renew") || note.includes("اشتراك")) {
    type = "renew";
  }

  return {
    id: payment._id?.toString?.() ?? payment.id,
    subscriptionId: payment.subscriptionId?._id?.toString?.() ||
      payment.subscriptionId?.toString?.(),
    type,
    amount: amount || 0,
    status: payment.status || "pending",
    createdAt: payment.createdAt,
  };
};

const computeAccountBalance = (payments) => {
  let balance = 0;

  for (const payment of payments) {
    if (payment.status !== "paid") continue;

    const amount = payment.totalAmount || payment.amount || 0;
    const note = String(payment.note || "").toLowerCase();

    if (note.includes("topup") || note.includes("scratch")) {
      balance += amount;
    }
  }

  return Math.max(0, balance);
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

      return ApiResponse.paginated(
        res,
        items.map((item) => toSubscriptionMobileDto(item)),
        total,
        page,
        limit
      );
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
      const periodEnd = subscription.nextBillingDate || new Date();
      const periodStart = SubscriptionService.addMonthsSafe(periodEnd, -1);
      const dailyUsage = await UsageService.getLastDaysUsage(subscription._id, 7);

      return ApiResponse.success(res, {
        subscriptionId: subscription._id.toString(),
        id: subscription._id.toString(),
        subscriptionNumber: subscription.subscriptionNumber,
        customer: subscription.customerId,
        plan: subscription.planId,
        usageGb,
        consumedGb: usageGb,
        dataLimitGb,
        quotaTotalGb: dataLimitGb,
        remainingGb: Math.max(0, dataLimitGb - usageGb),
        usagePercent,
        isUnlimited: dataLimitGb >= 999,
        periodStart,
        periodEnd,
        dailyUsage,
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

      const [latestPayments, paidPayments] = await Promise.all([
        Payment.find({ subscriptionId: subscription._id })
          .sort({ createdAt: -1 })
          .limit(3),
        Payment.find({ subscriptionId: subscription._id, status: "paid" }),
      ]);

      const dailyUsage = await UsageService.getLastDaysUsage(subscription._id, 7);

      return ApiResponse.success(res, {
        serviceStatus: subscription.status,
        nextBillingDate: subscription.nextBillingDate,
        accountBalance: computeAccountBalance(paidPayments),
        usage: {
          subscriptionId: subscription._id.toString(),
          isUnlimited: dataLimitGb >= 999,
          periodStart,
          periodEnd,
          quotaTotalGb: dataLimitGb,
          consumedGb: usageGb,
          remainingGb,
          dailyUsage,
        },
        latestTransactions: latestPayments.map(toTransactionItem),
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
      return ApiResponse.success(res, plans.map((plan) => toPlanMobileDto(plan)));
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

      const parsed = parseTopupScratchCode(req.body.scratchCode);
      if (!parsed) {
        throw new ValidationError("رمز الشحن غير صالح");
      }

      const card = await resolveTopupCouponCard(parsed);
      if (!card) {
        throw new ValidationError("كرت الشحن غير صالح أو غير موجود");
      }

      if (card.status === "used") {
        throw new ValidationError("تم استخدام هذا الكرت مسبقاً ولا يمكن تعبئته مجدداً");
      }

      const amount = card.value;
      if (!amount || Number.isNaN(amount) || amount <= 0) {
        throw new ValidationError("قيمة كرت الشحن غير صالحة");
      }

      const now = new Date();
      const invoice = await PaymentService.createSubscriptionInvoice({
        subscription,
        plan: subscription.planId,
        months: 1,
        paymentMethod: "wallet",
        markAsPaid: true,
        currency: "LYD",
        note: `Topup via card ${card.serialNumber}`,
        periodStart: now,
        periodEnd: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        dueDate: now,
      });

      invoice.amount = amount;
      invoice.totalAmount = amount;
      invoice.vatAmount = 0;
      await invoice.save();

      await redeemTopupCouponCard(card);

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

  static async tickets(req, res, next) {
    try {
      const { Subscription, SupportTicket } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id);

      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      ensureUserCanReadSubscription(req.user, subscription);

      const items = await SupportTicket.find({ subscriptionId: subscription._id })
        .sort({ createdAt: -1 });

      return ApiResponse.success(res, items.map(toTicketMobileDto));
    } catch (error) {
      return next(error);
    }
  }

  static async createTicket(req, res, next) {
    try {
      const { Subscription, SupportTicket } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id);

      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      ensureUserCanReadSubscription(req.user, subscription);

      const subject = String(req.body.subject || "").trim();
      const description = String(req.body.description || "").trim();

      if (subject.length < 4) {
        throw new ValidationError("Subject must be at least 4 characters");
      }

      if (description.length < 10) {
        throw new ValidationError("Description must be at least 10 characters");
      }

      const ticketNumber = await SupportTicketService.createTicketNumber();

      const ticket = await SupportTicket.create({
        ticketNumber,
        subscriptionId: subscription._id,
        customerId: subscription.customerId,
        subject,
        description,
        status: "open",
        priority: req.body.priority || "medium",
        category: req.body.category || "technical",
        replies: [
          {
            authorId: subscription.customerId,
            authorRole: "customer",
            message: description,
            createdAt: new Date(),
          },
        ],
      });

      return ApiResponse.created(res, toTicketMobileDto(ticket), "Support ticket created successfully");
    } catch (error) {
      return next(error);
    }
  }

  static async dailyUsage(req, res, next) {
    try {
      const { Subscription } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id);
      if (!subscription) throw new NotFoundError("Subscription not found");

      ensureUserCanReadSubscription(req.user, subscription);

      const dailyUsage = await UsageService.getLastDaysUsage(subscription._id, 7);
      return ApiResponse.success(res, dailyUsage);
    } catch (error) {
      return next(error);
    }
  }

  static async runSpeedTest(req, res, next) {
    try {
      const { Subscription } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id).populate(
        "planId",
        "name code speedMbps dataLimitGb monthlyPrice"
      );

      if (!subscription) throw new NotFoundError("Subscription not found");

      ensureUserCanReadSubscription(req.user, subscription);

      const result = await SpeedTestService.runForSubscription({
        subscription,
        customerId: subscription.customerId,
      });

      return ApiResponse.success(res, toSpeedTestDto(result), "Speed test completed");
    } catch (error) {
      return next(error);
    }
  }

  static async latestSpeedTest(req, res, next) {
    try {
      const { Subscription } = getDomainModels();
      const subscription = await Subscription.findById(req.params.id);
      if (!subscription) throw new NotFoundError("Subscription not found");

      ensureUserCanReadSubscription(req.user, subscription);

      const latest = await SpeedTestService.getLatest(subscription._id);
      return ApiResponse.success(res, toSpeedTestDto(latest));
    } catch (error) {
      return next(error);
    }
  }

  static async getAdvanceCredit(req, res, next) {
    try {
      const data = await AdvanceCreditService.getStatus({
        subscriptionId: req.params.id,
        user: req.user,
      });
      return ApiResponse.success(res, data, "Advance credit status");
    } catch (error) {
      return next(error);
    }
  }

  static async requestAdvanceCredit(req, res, next) {
    try {
      const data = await AdvanceCreditService.request({
        subscriptionId: req.params.id,
        user: req.user,
        amount: req.body.amount,
      });
      return ApiResponse.success(res, data, "Advance credit approved");
    } catch (error) {
      return next(error);
    }
  }
}

export default SubscriptionController;
