import { NotFoundError, ValidationError, ForbiddenError } from "../../utils/errors.js";
import { getCustomerDomainModels } from "../../utils/roleModels.js";
import { ensureUserCanReadSubscription } from "../../utils/subscriptionAccess.js";

const ADVANCE_CREDIT_RATIO = 0.5;

const resolveMaxAdvance = (subscription) => {
  const plan = subscription?.planId;
  const monthlyPrice =
    typeof plan === "object"
      ? plan.monthlyPrice || plan.price || 0
      : 0;

  return Math.max(10, Math.round(monthlyPrice * ADVANCE_CREDIT_RATIO));
};

const toAdvanceCreditDto = (subscription) => {
  const credit = subscription.advanceCredit || {};
  const maxRequest = resolveMaxAdvance(subscription);
  const owed = credit.owedAmount || 0;
  const pending = credit.pendingAmount || 0;
  const status = credit.status || "none";

  return {
    status,
    owedAmount: owed,
    pendingAmount: pending,
    maxRequest,
    available: status === "active" || status === "pending" ? 0 : maxRequest,
    canRequest:
      subscription.status === "active" &&
      status !== "pending" &&
      status !== "active" &&
      owed <= 0,
    lastRequestAt: credit.lastRequestAt || null,
    approvedAt: credit.approvedAt || null,
  };
};

class AdvanceCreditService {
  static async getStatus({ subscriptionId, user }) {
    const { Subscription } = getCustomerDomainModels();
    const subscription = await Subscription.findById(subscriptionId).populate(
      "planId",
      "name monthlyPrice price"
    );

    if (!subscription) {
      throw new NotFoundError("Subscription not found");
    }

    ensureUserCanReadSubscription(user, subscription);

    return toAdvanceCreditDto(subscription);
  }

  static async request({ subscriptionId, user, amount }) {
    const { Subscription } = getCustomerDomainModels();
    const subscription = await Subscription.findById(subscriptionId).populate(
      "planId",
      "name monthlyPrice price"
    );

    if (!subscription) {
      throw new NotFoundError("Subscription not found");
    }

    ensureUserCanReadSubscription(user, subscription);

    if (subscription.status !== "active") {
      throw new ForbiddenError("Advance credit is only available for active subscriptions");
    }

    const credit = subscription.advanceCredit || {};
    const maxRequest = resolveMaxAdvance(subscription);

    if (credit.status === "pending") {
      throw new ValidationError("You already have a pending advance credit request");
    }

    if (credit.status === "active" || (credit.owedAmount || 0) > 0) {
      throw new ValidationError("Please settle your current advance credit before requesting again");
    }

    const requestedAmount = Number(amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount < 5) {
      throw new ValidationError("Minimum advance credit amount is 5");
    }

    if (requestedAmount > maxRequest) {
      throw new ValidationError(`Maximum advance credit for your plan is ${maxRequest}`);
    }

    subscription.advanceCredit = {
      status: "active",
      owedAmount: requestedAmount,
      pendingAmount: 0,
      lastRequestAt: new Date(),
      approvedAt: new Date(),
    };

    await subscription.save();

    return {
      ...toAdvanceCreditDto(subscription),
      message:
        "تمت الموافقة على سلفتك. سيتم خصم المبلغ تلقائياً عند الشحن التالي.",
    };
  }
}

export default AdvanceCreditService;
