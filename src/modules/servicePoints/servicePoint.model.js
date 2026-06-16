import mongoose from "mongoose";

const servicePointSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["office", "agent", "salesPoint"],
      default: "agent",
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    phone: { type: String, default: "", trim: true },
    workingHours: { type: String, default: "9:00 ص - 5:00 م", trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("ServicePoint", servicePointSchema);

export const getServicePointModel = (connection) => {
  if (!connection) {
    return mongoose.model("ServicePoint", servicePointSchema);
  }

  return (
    connection.models.ServicePoint ||
    connection.model("ServicePoint", servicePointSchema)
  );
};
