import mongoose from "mongoose";

const usageDailySchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    usageGb: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

usageDailySchema.index({ subscriptionId: 1, date: 1 }, { unique: true });

export default mongoose.model("UsageDaily", usageDailySchema);

export const getUsageDailyModel = (connection) => {
  if (!connection) {
    return mongoose.model("UsageDaily", usageDailySchema);
  }

  return connection.models.UsageDaily || connection.model("UsageDaily", usageDailySchema);
};
