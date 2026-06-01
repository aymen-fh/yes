import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema(
  {
    serialNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    macAddress: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    firmwareVersion: {
      type: String,
      default: "",
      trim: true,
    },
    ipAddress: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["online", "offline", "maintenance", "fault"],
      default: "offline",
    },
    lastSeenAt: Date,
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Device", deviceSchema);

export const getDeviceModel = (connection) => {
  if (!connection) {
    return mongoose.model("Device", deviceSchema);
  }

  return connection.models.Device || connection.model("Device", deviceSchema);
};
