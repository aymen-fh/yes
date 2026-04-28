import CustomerModel from "../customers/customer.model.js";
import PlanModel from "../plans/plan.model.js";
import SubscriptionModel from "../subscriptions/subscription.model.js";
import PaymentModel from "../payments/payment.model.js";
import { serializeDocs } from "../common/serializers.js";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

class AdminController {
  static async dashboard(req, res, next) {
    try {
      const [
        totalCustomers,
        activeCustomers,
        totalPlans,
        activeSubscriptions,
        pendingPayments,
        paidRevenue,
        customers,
        plans,
        subscriptions,
        payments,
      ] = await Promise.all([
        CustomerModel.countDocuments(),
        CustomerModel.countDocuments({ status: "active" }),
        PlanModel.countDocuments(),
        SubscriptionModel.countDocuments({ status: "active" }),
        PaymentModel.countDocuments({ status: "pending" }),
        PaymentModel.aggregate([
          { $match: { status: "paid" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        CustomerModel.find().sort({ createdAt: -1 }).limit(12),
        PlanModel.find().sort({ createdAt: -1 }).limit(12),
        SubscriptionModel.find()
          .populate("customerId", "fullName customerCode")
          .populate("planId", "name code")
          .sort({ createdAt: -1 })
          .limit(12),
        PaymentModel.find()
          .populate("customerId", "fullName customerCode")
          .populate("subscriptionId", "subscriptionNumber")
          .sort({ createdAt: -1 })
          .limit(12),
      ]);

      return res.render("admin/dashboard", {
        stats: {
          totalCustomers,
          activeCustomers,
          totalPlans,
          activeSubscriptions,
          pendingPayments,
          paidRevenue: currencyFormatter.format(paidRevenue[0]?.total || 0),
        },
        customers: serializeDocs(customers, { exclude: ["password", "refreshTokenHash"] }),
        plans: serializeDocs(plans),
        subscriptions: serializeDocs(subscriptions),
        payments: serializeDocs(payments),
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default AdminController;
