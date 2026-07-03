import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    subscriptionNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "pending", "suspended", "cancelled"],
      default: "pending",
    },
    serviceType: {
      type: String,
      enum: ["ftth", "mobile4g5g", "adsl", "other"],
      default: "ftth",
    },
    branchName: {
      type: String,
      default: "",
      trim: true,
    },
    assignedIp: {
      type: String,
      default: "",
      trim: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    nextBillingDate: {
      type: Date,
      required: true,
    },
    dataUsageGb: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    advanceCredit: {
      status: {
        type: String,
        enum: ["none", "pending", "active", "rejected"],
        default: "none",
      },
      owedAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
      pendingAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
      lastRequestAt: {
        type: Date,
        default: null,
      },
      approvedAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

subscriptionSchema.index({ customerId: 1, status: 1 });

export default mongoose.model("Subscription", subscriptionSchema);

export const getSubscriptionModel = (connection) => {
  if (!connection) {
    return mongoose.model("Subscription", subscriptionSchema);
  }

  return connection.models.Subscription || connection.model("Subscription", subscriptionSchema);
};
