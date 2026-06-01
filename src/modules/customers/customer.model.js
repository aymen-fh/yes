import mongoose from "mongoose";
import { Roles } from "../../utils/roles.js";

const customerSchema = new mongoose.Schema(
  {
    customerCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(Roles),
      default: Roles.CUSTOMER,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "pending"],
      default: "active",
    },
    refreshTokenHash: {
      type: String,
      default: null,
    },
    lastLoginAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Customer", customerSchema);

export const getCustomerModel = (connection, role) => {
  const modelName = role ? `${role}_Customer` : "Customer";
  const collectionName = role ? `${role}s` : "customers";

  if (!connection) {
    return mongoose.models[modelName] || mongoose.model(modelName, customerSchema, collectionName);
  }

  return connection.models[modelName] || connection.model(modelName, customerSchema, collectionName);
};
