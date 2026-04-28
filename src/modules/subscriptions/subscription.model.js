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
  },
  {
    timestamps: true,
  }
);

subscriptionSchema.index({ customerId: 1, status: 1 });

export default mongoose.model("Subscription", subscriptionSchema);
