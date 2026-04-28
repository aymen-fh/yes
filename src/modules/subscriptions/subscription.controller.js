import { ApiResponse } from "../../utils/apiResponse.js";
import { ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { createReadableCode, serializeDoc, serializeDocs } from "../common/serializers.js";
import CustomerModel from "../customers/customer.model.js";
import DeviceModel from "../devices/device.model.js";
import PaymentModel from "../payments/payment.model.js";
import PlanModel from "../plans/plan.model.js";
import SubscriptionService from "./subscription.service.js";
import SubscriptionModel from "./subscription.model.js";

const ensurePlanAndCustomer = async ({ planId, customerId }) => {
  const [plan, customer] = await Promise.all([
    PlanModel.findById(planId),
    CustomerModel.findById(customerId),
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

const createSubscriptionNumber = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const number = createReadableCode("SUB");
    const exists = await SubscriptionModel.exists({ subscriptionNumber: number });
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

class SubscriptionController {
  static async list(req, res, next) {
    try {
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
        SubscriptionModel.find(query)
          .populate("customerId", "fullName customerCode email")
          .populate("planId", "name code speedMbps dataLimitGb monthlyPrice")
          .populate("deviceId", "serialNumber model status ipAddress")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        SubscriptionModel.countDocuments(query),
      ]);

      return ApiResponse.paginated(res, serializeDocs(items), total, page, limit);
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const subscription = await SubscriptionModel.findById(req.params.id)
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

      const subscription = await SubscriptionModel.create({
        subscriptionNumber,
        ...createPayload,
      });

      if (req.body.deviceId) {
        await DeviceModel.findByIdAndUpdate(req.body.deviceId, {
          customerId: req.body.customerId,
          subscriptionId: subscription._id,
          status: "online",
          lastSeenAt: new Date(),
        });
      }

      const item = await SubscriptionModel.findById(subscription._id)
        .populate("customerId", "fullName customerCode email")
        .populate("planId", "name code speedMbps dataLimitGb monthlyPrice vatPercent")
        .populate("deviceId", "serialNumber model status ipAddress");

      const activationInvoice = await SubscriptionService.createActivationInvoiceIfNeeded({
        subscription: item,
        plan: item.planId || plan,
      });

      if (activationInvoice) {
        const invoiceItem = await PaymentModel.findById(activationInvoice._id)
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
      const existing = await SubscriptionModel.findById(req.params.id);
      if (!existing) {
        throw new NotFoundError("Subscription not found");
      }

      if (req.body.planId || req.body.customerId) {
        await ensurePlanAndCustomer({
          planId: req.body.planId || existing.planId,
          customerId: req.body.customerId || existing.customerId,
        });
      }

      const updated = await SubscriptionModel.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      })
        .populate("customerId", "fullName customerCode email")
        .populate("planId", "name code speedMbps dataLimitGb monthlyPrice vatPercent")
        .populate("deviceId", "serialNumber model status ipAddress");

      if (req.body.deviceId) {
        await DeviceModel.findByIdAndUpdate(req.body.deviceId, {
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
        const invoiceItem = await PaymentModel.findById(activationInvoice._id)
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
      const subscription = await SubscriptionModel.findById(req.params.id)
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

  static async renew(req, res, next) {
    try {
      const { months, paymentMethod, markAsPaid, currency, note } = req.body;

      const subscription = await SubscriptionModel.findById(req.params.id)
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

      const refreshedSubscription = await SubscriptionModel.findById(subscription._id)
        .populate("customerId", "fullName customerCode email status")
        .populate("planId", "name code speedMbps dataLimitGb monthlyPrice vatPercent")
        .populate("deviceId", "serialNumber model status ipAddress");

      const paymentItem = await PaymentModel.findById(payment._id)
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
}

export default SubscriptionController;
