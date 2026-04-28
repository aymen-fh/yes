import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    speedMbps: {
      type: Number,
      required: true,
      min: 1,
    },
    dataLimitGb: {
      type: Number,
      required: true,
      min: 1,
    },
    monthlyPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    durationMonths: {
      type: Number,
      default: 1,
      min: 1,
      max: 24,
    },
    vatPercent: {
      type: Number,
      default: 15,
      min: 0,
      max: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    features: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Plan", planSchema);
