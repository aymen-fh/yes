import { ForbiddenError } from "./errors.js";

export const getSubscriptionCustomerId = (subscription) => {
  if (!subscription?.customerId) return null;

  if (typeof subscription.customerId === "object") {
    return (
      subscription.customerId._id?.toString?.() ||
      subscription.customerId.id?.toString?.() ||
      null
    );
  }

  return subscription.customerId.toString();
};

export const ensureUserCanReadSubscription = (reqUser, subscription) => {
  if (!reqUser || reqUser.role !== "customer") return;

  const ownerId = getSubscriptionCustomerId(subscription);
  if (!ownerId || ownerId !== reqUser.id) {
    throw new ForbiddenError("You can only view your own subscription");
  }
};
