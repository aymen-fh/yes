/**
 * Builds rich subscriber context for OXY from the database.
 * Used server-side so OXY can answer account-specific questions accurately.
 */

import { Roles } from "../../utils/roles.js";
import { getModelsForRole } from "../../utils/roleModels.js";

const SUPPORT = {
  phone: "19000",
  phoneDisplay: "+218 91 000 0000",
  email: "support@oxygen.app",
};

const computeAccountBalance = (payments) => {
  let balance = 0;
  for (const payment of payments) {
    if (payment.status !== "paid") continue;
    const amount = payment.totalAmount || payment.amount || 0;
    const note = String(payment.note || "").toLowerCase();
    if (note.includes("topup") || note.includes("scratch") || note.includes("شحن")) {
      balance += amount;
    }
  }
  return Math.max(0, balance);
};

const resolveMaxAdvance = (subscription) => {
  const plan = subscription?.planId;
  const monthlyPrice =
    typeof plan === "object" ? plan.monthlyPrice || plan.price || 0 : 0;
  return Math.max(10, Math.round(monthlyPrice * 0.5));
};

const toAdvanceCreditDto = (subscription) => {
  const credit = subscription.advanceCredit || {};
  const maxRequest = resolveMaxAdvance(subscription);
  const owed = credit.owedAmount || 0;
  const status = credit.status || "none";

  return {
    status,
    owedAmount: owed,
    pendingAmount: credit.pendingAmount || 0,
    maxRequest,
    available: status === "active" || status === "pending" ? 0 : maxRequest,
    canRequest:
      subscription.status === "active" &&
      status !== "pending" &&
      status !== "active" &&
      owed <= 0,
  };
};

const formatDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const statusLabelAr = (status) => {
  const map = {
    active: "نشط",
    pending: "قيد التفعيل",
    suspended: "موقوف",
    cancelled: "ملغى",
  };
  return map[status] || status;
};

/**
 * @param {{ customerId?: string, role?: string }} params
 * @returns {Promise<Record<string, unknown>>}
 */
export async function buildOxyContext({ customerId, role }) {
  if (!customerId || role !== Roles.CUSTOMER) {
    return { support: SUPPORT };
  }

  const { Customer, Subscription, Payment, SupportTicket, Plan } = getModelsForRole(
    Roles.CUSTOMER,
  );

  const [customer, subscription, availablePlansRaw] = await Promise.all([
    Customer.findById(customerId).select("fullName customerCode email phone").lean(),
    Subscription.findOne({ customerId, status: { $in: ["active", "pending", "suspended"] } })
      .sort({ status: 1, createdAt: -1 })
      .populate("planId", "name code speedMbps dataLimitGb monthlyPrice")
      .lean(),
    Plan.find({ isActive: true })
      .sort({ monthlyPrice: 1 })
      .select("name code speedMbps dataLimitGb monthlyPrice isUnlimited validityLabel description")
      .limit(30)
      .lean(),
  ]);

  const base = {
    support: SUPPORT,
    customer: customer
      ? {
          name: customer.fullName || "",
          code: customer.customerCode || "",
        }
      : null,
  };

  if (!subscription) {
    return {
      ...base,
      subscription: null,
      note: "لا يوجد اشتراك نشط مرتبط بهذا الحساب.",
    };
  }

  const plan = subscription.planId || {};
  const dataLimitGb = plan.dataLimitGb || 0;
  const usageGb = subscription.dataUsageGb || 0;
  const isUnlimited = dataLimitGb >= 999;
  const remainingGb = isUnlimited ? null : Math.max(0, dataLimitGb - usageGb);

  const [paidPayments, latestPayments, openTicketsCount] = await Promise.all([
    Payment.find({ subscriptionId: subscription._id, status: "paid" })
      .select("totalAmount amount note status createdAt")
      .lean(),
    Payment.find({ subscriptionId: subscription._id })
      .sort({ createdAt: -1 })
      .limit(3)
      .select("totalAmount amount status note createdAt")
      .lean(),
    SupportTicket.countDocuments({
      subscriptionId: subscription._id,
      status: { $nin: ["closed", "resolved", "مغلقة", "محلولة"] },
    }),
  ]);

  const advanceCredit = toAdvanceCreditDto(subscription);

  const availablePlans = (availablePlansRaw || []).map((p) => ({
    name: p.name,
    code: p.code,
    speedMbps: p.speedMbps,
    dataLimitGb: p.dataLimitGb,
    monthlyPrice: p.monthlyPrice,
    isUnlimited: p.isUnlimited || p.dataLimitGb >= 999,
    validityLabel: p.validityLabel || "",
    description: (p.description || "").slice(0, 120),
  }));

  return {
    ...base,
    subscription: {
      number: subscription.subscriptionNumber,
      status: subscription.status,
      statusLabel: statusLabelAr(subscription.status),
      serviceType: subscription.serviceType || "ftth",
      branchName: subscription.branchName || "",
      nextBillingDate: formatDate(subscription.nextBillingDate),
      plan: {
        name: plan.name || "",
        price: plan.monthlyPrice || plan.price || 0,
        speedMbps: plan.speedMbps || 0,
        quotaGb: isUnlimited ? null : dataLimitGb,
        isUnlimited,
      },
    },
    usage: {
      consumedGb: Math.round(usageGb * 100) / 100,
      remainingGb: remainingGb != null ? Math.round(remainingGb * 100) / 100 : null,
      quotaTotalGb: isUnlimited ? null : dataLimitGb,
      isUnlimited,
      periodEnd: formatDate(subscription.nextBillingDate),
    },
    accountBalance: computeAccountBalance(paidPayments),
    advanceCredit,
    openTicketsCount,
    availablePlans,
    latestTransactions: latestPayments.map((p) => ({
      amount: p.totalAmount || p.amount || 0,
      status: p.status,
      date: formatDate(p.createdAt),
      note: (p.note || "").slice(0, 80),
    })),
    appNavigation: {
      topup: "الرئيسية ← شحن الرصيد",
      plans: "تبويب الباقات",
      usage: "تبويب الاستهلاك",
      salfni: "الخدمات ← سلفني",
      agents: "الخدمات ← خريطة الوكلاء",
      support: "الخدمات ← الدعم الفني",
      oxyChat: "الخدمات ← أوكسي OXY",
    },
  };
}

export default { buildOxyContext };
