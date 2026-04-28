import { ApiResponse } from "../../utils/apiResponse.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../utils/errors.js";
import { serializeDoc, serializeDocs } from "../common/serializers.js";
import CustomerModel from "../customers/customer.model.js";
import SubscriptionModel from "../subscriptions/subscription.model.js";
import PaymentService from "./payment.service.js";
import PaymentModel from "./payment.model.js";

const ensureUserCanReadPayment = (reqUser, payment) => {
  if (reqUser.role !== "customer") return;

  const paymentCustomerId = payment.customerId?._id?.toString?.() || payment.customerId?.toString?.();
  if (paymentCustomerId !== reqUser.id) {
    throw new ForbiddenError("You can only access your own payments");
  }
};

const ensurePaymentRelations = async ({ customerId, subscriptionId }) => {
  const [customer, subscription] = await Promise.all([
    CustomerModel.findById(customerId),
    SubscriptionModel.findById(subscriptionId),
  ]);

  if (!customer) {
    throw new NotFoundError("Customer not found");
  }

  if (!subscription) {
    throw new NotFoundError("Subscription not found");
  }

  if (subscription.customerId.toString() !== customerId.toString()) {
    throw new ValidationError("Subscription does not belong to the selected customer");
  }
};

class PaymentController {
  static async list(req, res, next) {
    try {
      const { page, limit, customerId, subscriptionId, status } = req.query;
      const query = {};

      if (req.user.role === "customer") {
        query.customerId = req.user.id;
      } else if (customerId) {
        query.customerId = customerId;
      }

      if (subscriptionId) {
        query.subscriptionId = subscriptionId;
      }

      if (status) {
        query.status = status;
      }

      const [items, total] = await Promise.all([
        PaymentModel.find(query)
          .populate("customerId", "fullName customerCode email")
          .populate("subscriptionId", "subscriptionNumber status")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        PaymentModel.countDocuments(query),
      ]);

      return ApiResponse.paginated(res, serializeDocs(items), total, page, limit);
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const payment = await PaymentModel.findById(req.params.id)
        .populate("customerId", "fullName customerCode email")
        .populate("subscriptionId", "subscriptionNumber status");

      if (!payment) {
        throw new NotFoundError("Payment not found");
      }

      ensureUserCanReadPayment(req.user, payment);

      return ApiResponse.success(res, serializeDoc(payment));
    } catch (error) {
      return next(error);
    }
  }

  static async create(req, res, next) {
    try {
      await ensurePaymentRelations(req.body);

      const invoiceNumber = await PaymentService.createInvoiceNumber();
      const payload = {
        ...req.body,
        invoiceNumber,
        currency: req.body.currency.toUpperCase(),
      };

      const payment = await PaymentModel.create(payload);
      const item = await PaymentModel.findById(payment._id)
        .populate("customerId", "fullName customerCode email")
        .populate("subscriptionId", "subscriptionNumber status");

      return ApiResponse.created(res, serializeDoc(item), "Payment created successfully");
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const payload = { ...req.body };

      if (payload.status === "paid" && !payload.paidAt) {
        payload.paidAt = new Date();
      }

      const payment = await PaymentModel.findByIdAndUpdate(req.params.id, payload, {
        new: true,
      })
        .populate("customerId", "fullName customerCode email")
        .populate("subscriptionId", "subscriptionNumber status");

      if (!payment) {
        throw new NotFoundError("Payment not found");
      }

      return ApiResponse.success(res, serializeDoc(payment), "Payment updated");
    } catch (error) {
      return next(error);
    }
  }

  static async stats(req, res, next) {
    try {
      const [summary] = await PaymentModel.aggregate([
        {
          $group: {
            _id: null,
            totalInvoices: { $sum: 1 },
            totalCollected: {
              $sum: {
                $cond: [{ $eq: ["$status", "paid"] }, "$totalAmount", 0],
              },
            },
            totalPending: {
              $sum: {
                $cond: [{ $eq: ["$status", "pending"] }, "$totalAmount", 0],
              },
            },
          },
        },
      ]);

      return ApiResponse.success(res, {
        totalInvoices: summary?.totalInvoices || 0,
        totalCollected: summary?.totalCollected || 0,
        totalPending: summary?.totalPending || 0,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default PaymentController;
