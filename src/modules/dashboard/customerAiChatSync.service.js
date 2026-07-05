import { createReadableCode } from "../common/serializers.js";
import { Roles } from "../../utils/roles.js";
import { getModelsForRole } from "../../utils/roleModels.js";
import { CustomerAiChat } from "./dashboard.models.js";

const PROBLEM_CATEGORIES = [
  {
    id: "network",
    label: "شبكة وإشارة",
    route: "tech_support",
    keywords: ["إشارة", "شبكة", "بطيء", "سرعة", "انقطاع جزئي", "wifi", "واي فاي", "تغطية"],
  },
  {
    id: "outage",
    label: "انقطاع كامل",
    route: "tech_support",
    keywords: ["انقطاع", "لا يعمل", "مفصول", "مقطوع", "خارج الخدمة", "offline"],
  },
  {
    id: "billing",
    label: "فواتير وشحن",
    route: "admin",
    keywords: ["رصيد", "شحن", "فاتورة", "دفع", "كرت", "تعبئة", "محفظة", "سعر"],
  },
  {
    id: "installation",
    label: "تركيب وتفعيل",
    route: "tech_support",
    keywords: ["تركيب", "جديد", "تفعيل", "خط جديد", "منزل", "اشتراك"],
  },
  {
    id: "equipment",
    label: "أجهزة ومعدات",
    route: "tech_support",
    keywords: ["راوتر", "مودم", "جهاز", "كابل", "استبدال", "عطل"],
  },
  {
    id: "system",
    label: "منظومة وصلاحيات",
    route: "tech_support",
    keywords: ["نظام", "صلاحية", "حساب", "دخول", "خطأ تقني", "منظومة", "سيرفر"],
  },
  {
    id: "general",
    label: "استفسار عام",
    route: "admin",
    keywords: [],
  },
];

const classifyFromText = (text) => {
  const normalized = String(text || "").toLowerCase();
  let best = PROBLEM_CATEGORIES[PROBLEM_CATEGORIES.length - 1];
  let bestScore = 0;

  for (const cat of PROBLEM_CATEGORIES) {
    const score = cat.keywords.reduce(
      (sum, kw) => sum + (normalized.includes(kw.toLowerCase()) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }

  const priority =
    best.id === "outage" || normalized.includes("حرج") || normalized.includes("عاجل")
      ? "critical"
      : best.id === "network" || best.id === "equipment"
        ? "high"
        : best.id === "billing"
          ? "medium"
          : "low";

  const sentences = String(text || "")
    .split(/[.!?\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const summary = sentences.slice(0, 2).join(" — ") || String(text || "").slice(0, 120);

  return {
    categoryLabel: best.label,
    priority,
    summary,
    suggestedRoute: best.route,
  };
};

const nextSessionCode = async () => {
  const Model = CustomerAiChat();
  for (let i = 0; i < 8; i += 1) {
    const code = createReadableCode("CHAT");
    const exists = await Model.exists({ sessionCode: code });
    if (!exists) return code;
  }
  return `${createReadableCode("CHAT")}-${Date.now().toString().slice(-4)}`;
};

const loadCustomer = async (customerId) => {
  const { Customer } = getModelsForRole(Roles.CUSTOMER);
  return Customer.findById(customerId);
};

class CustomerAiChatSyncService {
  /**
   * Persist mobile customer messages so the web customer-service panel can see them.
   * Failures are logged but never thrown — callers should not block the main request.
   */
  static async syncCustomerMessage({
    customerId,
    customerMessage,
    assistantMessage = null,
    ticketId = null,
  }) {
    const trimmed = String(customerMessage || "").trim();
    if (!trimmed || !customerId) return null;

    const customer = await loadCustomer(customerId);
    if (!customer) return null;

    const Model = CustomerAiChat();
    const now = new Date().toISOString();
    const classification = classifyFromText(trimmed);

    let chat = await Model.findOne({
      customerId: customer._id.toString(),
      status: { $in: ["active", "awaiting_cs"] },
    }).sort({ updatedAt: -1 });

    const incoming = [{ role: "customer", content: trimmed, createdAt: now }];
    if (assistantMessage?.trim()) {
      incoming.push({
        role: "assistant",
        content: assistantMessage.trim(),
        createdAt: now,
      });
    }

    if (!chat) {
      chat = await Model.create({
        sessionCode: await nextSessionCode(),
        customerId: customer._id.toString(),
        customerName: customer.fullName,
        customerPhone: customer.phone || "",
        status: "awaiting_cs",
        aiCategory: classification.categoryLabel,
        aiSummary: classification.summary,
        priority: classification.priority,
        suggestedRoute: classification.suggestedRoute,
        ticketId: ticketId ? String(ticketId) : null,
        lastMessageAt: now,
        messages: incoming,
      });
      return chat;
    }

    const last = chat.messages?.[chat.messages.length - 1];
    if (last?.role === "customer" && last?.content === trimmed && !assistantMessage) {
      return chat;
    }
    if (
      assistantMessage &&
      last?.role === "assistant" &&
      last?.content === assistantMessage.trim() &&
      chat.messages?.[chat.messages.length - 2]?.content === trimmed
    ) {
      return chat;
    }

    chat.messages = [...(chat.messages || []), ...incoming];
    chat.lastMessageAt = now;
    if (ticketId && !chat.ticketId) {
      chat.ticketId = String(ticketId);
    }
    chat.aiCategory = classification.categoryLabel;
    chat.aiSummary = classification.summary;
    chat.priority = classification.priority;
    chat.suggestedRoute = classification.suggestedRoute;
    if (chat.status === "active") {
      chat.status = "awaiting_cs";
    }
    await chat.save();
    return chat;
  }

  static async syncStaffReply({ customerId, ticketId, message, staffName = "خدمة العملاء" }) {
    const trimmed = String(message || "").trim();
    if (!trimmed || !customerId) return null;

    const Model = CustomerAiChat();
    const now = new Date().toISOString();
    const content = `${staffName}: ${trimmed}`;

    let chat = null;
    if (ticketId) {
      chat = await Model.findOne({ ticketId: String(ticketId) }).sort({ updatedAt: -1 });
    }
    if (!chat) {
      chat = await Model.findOne({
        customerId: String(customerId),
        status: { $in: ["active", "awaiting_cs", "routed"] },
      }).sort({ updatedAt: -1 });
    }
    if (!chat) return null;

    const last = chat.messages?.[chat.messages.length - 1];
    if (last?.role === "staff" && last?.content === content) {
      return chat;
    }

    chat.messages = [
      ...(chat.messages || []),
      { role: "staff", content, createdAt: now },
    ];
    chat.lastMessageAt = now;
    if (ticketId && !chat.ticketId) {
      chat.ticketId = String(ticketId);
    }
    await chat.save();
    return chat;
  }
}

export default CustomerAiChatSyncService;
