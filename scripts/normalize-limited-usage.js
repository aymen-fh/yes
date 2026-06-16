import "dotenv/config";
import mongoose from "mongoose";
import { getRoleDb } from "../src/utils/roleDb.js";
import { Roles } from "../src/utils/roles.js";
import { getSubscriptionModel } from "../src/modules/subscriptions/subscription.model.js";
import { getPlanModel } from "../src/modules/plans/plan.model.js";
import { getUsageDailyModel } from "../src/modules/usage/usageDaily.model.js";

const startOfDay = (input = new Date()) => {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
};

const weights = [0.75, 0.95, 1.15, 0.85, 1.05, 0.9, 1.35];
const weightSum = weights.reduce((acc, value) => acc + value, 0);

const seedUsageForSubscription = async (UsageDaily, subscriptionId, totalGb) => {
  await UsageDaily.deleteMany({ subscriptionId });
  for (let offset = 0; offset < 7; offset += 1) {
    const day = startOfDay(new Date());
    day.setDate(day.getDate() - (6 - offset));
    await UsageDaily.create({
      subscriptionId,
      date: day,
      usageGb: Number(((totalGb * weights[offset]) / weightSum).toFixed(2)),
    });
  }
};

const run = async () => {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.MONGO_DB_NAME;

  if (!mongoUrl || !dbName) {
    throw new Error("Missing MONGO_URL or MONGO_DB_NAME in environment");
  }

  await mongoose.connect(mongoUrl, { dbName });

  const db = getRoleDb(Roles.CUSTOMER);
  const Subscription = getSubscriptionModel(db);
  const Plan = getPlanModel(db);
  const UsageDaily = getUsageDailyModel(db);

  const subscriptions = await Subscription.find({}).lean();
  let fixed = 0;

  for (const sub of subscriptions) {
    const plan = await Plan.findById(sub.planId).lean();
    if (!plan) continue;

    const isUnlimited = Boolean(plan.isUnlimited) || Number(plan.dataLimitGb || 0) >= 999;
    if (isUnlimited) continue;

    const limitGb = Number(plan.dataLimitGb || 0);
    if (limitGb <= 0) continue;

    const currentUsage = Number(sub.dataUsageGb || 0);
    if (currentUsage <= limitGb) continue;

    const normalizedUsage = Number((limitGb * 0.85).toFixed(2));
    await Subscription.updateOne(
      { _id: sub._id },
      { $set: { dataUsageGb: normalizedUsage } },
    );
    await seedUsageForSubscription(UsageDaily, sub._id, normalizedUsage);
    fixed += 1;
  }

  console.log(`Normalized subscriptions: ${fixed}`);
  await mongoose.connection.close();
};

run().catch(async (error) => {
  console.error("Failed to normalize limited usage:", error);
  await mongoose.connection.close();
  process.exit(1);
});
