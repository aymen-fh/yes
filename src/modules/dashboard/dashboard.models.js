import mongoose from "mongoose";
import { getRoleDb } from "../../utils/roleDb.js";
import { Roles } from "../../utils/roles.js";

const agentProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    region: { type: String, default: "", trim: true },
    balance: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 },
    todayRefills: { type: Number, default: 0 },
    todayCommission: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
  },
  { timestamps: true }
);

const engineerProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    specialization: { type: String, default: "دعم فني", trim: true },
    activeTasks: { type: Number, default: 0 },
    status: { type: String, enum: ["available", "busy", "offline"], default: "available" },
  },
  { timestamps: true }
);

const couponCardSchema = new mongoose.Schema(
  {
    serialNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    pinCode: { type: String, required: true, trim: true },
    value: { type: Number, required: true },
    status: { type: String, enum: ["available", "sold", "used"], default: "available" },
    soldBy: { type: String, default: null },
    soldDate: { type: String, default: null },
  },
  { timestamps: true }
);

const dailyReportSchema = new mongoose.Schema(
  {
    reportCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true, trim: true },
    authorRole: {
      type: String,
      enum: ["admin", "agent", "customer_service", "tech_support", "system_engineer"],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    metrics: {
      refillsMade: Number,
      cardsSold: Number,
      newInstallations: Number,
      resolvedComplaints: Number,
    },
  },
  { timestamps: true }
);

const auditLogSchema = new mongoose.Schema(
  {
    logCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    timestamp: { type: String, required: true },
    userRole: {
      type: String,
      enum: ["admin", "agent", "customer_service", "tech_support", "system_engineer"],
      required: true,
    },
    userName: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    details: { type: String, default: "", trim: true },
    ipAddress: { type: String, default: "" },
    status: { type: String, enum: ["success", "warning", "error"], default: "success" },
  },
  { timestamps: true }
);

const systemPermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["admin", "agent", "customer_service", "tech_support", "system_engineer"],
      required: true,
    },
    module: { type: String, required: true, trim: true },
    canView: { type: Boolean, default: false },
    canCreate: { type: Boolean, default: false },
    canEdit: { type: Boolean, default: false },
    canDelete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

systemPermissionSchema.index({ role: 1, module: 1 }, { unique: true });

const agentRequestSchema = new mongoose.Schema(
  {
    requestCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    agentId: { type: String, required: true },
    agentName: { type: String, required: true, trim: true },
    type: { type: String, enum: ["new_contract", "edit_contract"], required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    customerData: {
      name: String,
      phone: String,
      idNumber: String,
      contractType: { type: String, enum: ["fiber", "vdsl", "wireless"] },
      city: String,
      region: String,
      signal: String,
    },
    responseNotes: { type: String, default: "" },
  },
  { timestamps: true }
);

const internalMessageSchema = new mongoose.Schema(
  {
    senderId: { type: String, required: true },
    senderName: { type: String, required: true, trim: true },
    senderRole: {
      type: String,
      enum: ["admin", "agent", "customer_service", "tech_support", "system_engineer"],
      required: true,
    },
    receiverRole: {
      type: String,
      enum: ["admin", "agent", "customer_service", "tech_support", "system_engineer", "all"],
      required: true,
    },
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    timestamp: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const getDb = () => getRoleDb(Roles.CUSTOMER);

const registerModel = (name, schema) => {
  const db = getDb();
  return db.models[name] || db.model(name, schema);
};

export const AgentProfile = () => registerModel("AgentProfile", agentProfileSchema);
export const EngineerProfile = () => registerModel("EngineerProfile", engineerProfileSchema);
export const CouponCard = () => registerModel("CouponCard", couponCardSchema);
export const DailyReport = () => registerModel("DailyReport", dailyReportSchema);
export const AuditLog = () => registerModel("AuditLog", auditLogSchema);
export const SystemPermission = () => registerModel("SystemPermission", systemPermissionSchema);
export const AgentRequest = () => registerModel("AgentRequest", agentRequestSchema);
export const InternalMessage = () => registerModel("InternalMessage", internalMessageSchema);
