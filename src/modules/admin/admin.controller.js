import { getCustomerDomainModels } from "../../utils/roleModels.js";
import { serializeDocs } from "../common/serializers.js";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

class AdminController {
  static async dashboard(req, res, next) {
    try {
      const { Customer, Plan, Subscription, Payment } = getCustomerDomainModels();
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
        Customer.countDocuments(),
        Customer.countDocuments({ status: "active" }),
        Plan.countDocuments(),
        Subscription.countDocuments({ status: "active" }),
        Payment.countDocuments({ status: "pending" }),
        Payment.aggregate([
          { $match: { status: "paid" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Customer.find().sort({ createdAt: -1 }).limit(12),
        Plan.find().sort({ createdAt: -1 }).limit(12),
        Subscription.find()
          .populate("customerId", "fullName customerCode")
          .populate("planId", "name code")
          .sort({ createdAt: -1 })
          .limit(12),
        Payment.find()
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
