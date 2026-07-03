import mongoose from "mongoose";
import SupportTicketService from "./supportTicket.service.js";

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
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
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    category: {
      type: String,
      enum: ["technical", "billing", "account", "other"],
      default: "technical",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    replies: [
      {
        authorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Customer",
          required: true,
        },
        authorRole: {
          type: String,
          enum: [
            "customer",
            "admin",
            "agent",
            "distributor",
            "support",
            "tech_support",
            "customer_service",
            "system_engineer",
          ],
          required: true,
        },
        message: {
          type: String,
          required: true,
          trim: true,
          maxlength: 1000,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    resolutionNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    dashboardMeta: {
      chatSessionId: { type: String, default: null },
      aiCategory: { type: String, default: null },
      aiSummary: { type: String, default: null },
      routedToRole: {
        type: String,
        enum: ["admin", "agent", "customer_service", "tech_support", "system_engineer", null],
        default: null,
      },
      routedToDepartment: { type: String, default: null },
      routedByName: { type: String, default: null },
      routedAt: { type: String, default: null },
      resolutionOutcome: {
        type: String,
        enum: ["pending", "resolved", "not_resolved", null],
        default: null,
      },
      specialistResponse: { type: String, default: null },
      specialistName: { type: String, default: null },
      specialistRespondedAt: { type: String, default: null },
      assignedEngineerId: { type: String, default: null },
      assignedEngineerName: { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

supportTicketSchema.index({ customerId: 1, status: 1, createdAt: -1 });

supportTicketSchema.pre("validate", async function ensureTicketNumber() {
  if (this.ticketNumber) return;

  this.ticketNumber = await SupportTicketService.createTicketNumber();
});

export default mongoose.model("SupportTicket", supportTicketSchema);

export const getSupportTicketModel = (connection) => {
  if (!connection) {
    return mongoose.model("SupportTicket", supportTicketSchema);
  }

  return connection.models.SupportTicket || connection.model("SupportTicket", supportTicketSchema);
};
