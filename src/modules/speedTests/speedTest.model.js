import mongoose from "mongoose";

const speedTestSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    pingMs: {
      type: Number,
      required: true,
      min: 0,
    },
    downloadMbps: {
      type: Number,
      required: true,
      min: 0,
    },
    uploadMbps: {
      type: Number,
      required: true,
      min: 0,
    },
    testedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

speedTestSchema.index({ subscriptionId: 1, testedAt: -1 });

export default mongoose.model("SpeedTest", speedTestSchema);

export const getSpeedTestModel = (connection) => {
  if (!connection) {
    return mongoose.model("SpeedTest", speedTestSchema);
  }

  return connection.models.SpeedTest || connection.model("SpeedTest", speedTestSchema);
};
