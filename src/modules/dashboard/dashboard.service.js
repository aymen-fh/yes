import EncryptionServices from "../../utils/encryptionServices.js";
import { NotFoundError, ValidationError } from "../../utils/errors.js";
import { Roles, STAFF_ROLES, getRoleCodePrefix } from "../../utils/roles.js";
import { findUserByIdAcrossRoles, getModelsForRole } from "../../utils/roleModels.js";
import {
  COUPON_CARD_SERIAL_LENGTH,
  createNumericCode,
  createReadableCode,
  isValidCouponCardSerial,
  serializeDoc,
  toNumericSerial,
} from "../common/serializers.js";
import {
  AgentProfile,
  EngineerProfile,
  CouponCard,
  DailyReport,
  AuditLog,
  SystemPermission,
  AgentRequest,
  InternalMessage,
  CustomerAiChat,
} from "./dashboard.models.js";

const resolveModel = (Model) => (Model?.modelName ? Model : Model());

const nextCode = async (Model, field, prefix) => {
  const MongooseModel = resolveModel(Model);
  for (let i = 0; i < 8; i += 1) {
    const code = createReadableCode(prefix);
    const exists = await MongooseModel.exists({ [field]: code });
    if (!exists) return code;
  }
  return `${createReadableCode(prefix)}-${Date.now().toString().slice(-4)}`;
};

const nextNumericCode = async (Model, field, length = COUPON_CARD_SERIAL_LENGTH) => {
  const MongooseModel = resolveModel(Model);
  for (let i = 0; i < 12; i += 1) {
    const code = createNumericCode(length);
    const exists = await MongooseModel.exists({ [field]: code });
    if (!exists) return code;
  }
  return Date.now().toString().slice(-length);
};

const toDto = (doc) => serializeDoc(doc);

const listStaffUsers = async () => {
  const users = [];
  for (const role of STAFF_ROLES) {
    const { Customer } = getModelsForRole(role);
    const items = await Customer.find().sort({ createdAt: -1 });
    users.push(...items.map((u) => toDto(u)));
  }
  return users;
};

const listCustomers = async () => {
  const { Customer } = getModelsForRole(Roles.CUSTOMER);
  const items = await Customer.find().sort({ createdAt: -1 }).limit(500);
  return items.map((c) => toDto(c));
};

const listAgents = async () => {
  const { Customer } = getModelsForRole(Roles.DISTRIBUTOR);
  const profiles = await AgentProfile().find().sort({ createdAt: -1 });
  const results = [];
  for (const profile of profiles) {
    const user = await Customer.findById(profile.userId);
    const dto = toDto(profile);
    if (!dto.profileCode && user?.customerCode) {
      profile.profileCode = user.customerCode;
      await profile.save();
      dto.profileCode = user.customerCode;
    }
    dto.customerCode = user?.customerCode ?? dto.profileCode;
    results.push(dto);
  }
  return results;
};

const listEngineers = async () => {
  const engineerRoles = [Roles.SUPPORT, Roles.SYSTEM_ENGINEER];
  const profiles = await EngineerProfile().find().sort({ createdAt: -1 });
  const results = [];
  for (const profile of profiles) {
    let user = null;
    for (const role of engineerRoles) {
      const { Customer } = getModelsForRole(role);
      user = await Customer.findById(profile.userId);
      if (user) break;
    }
    const dto = toDto(profile);
    if (!dto.profileCode && user?.customerCode) {
      profile.profileCode = user.customerCode;
      await profile.save();
      dto.profileCode = user.customerCode;
    }
    dto.customerCode = user?.customerCode ?? dto.profileCode;
    results.push(dto);
  }
  return results;
};

const ensureEngineerProfiles = async () => {
  const engineerRoles = [Roles.SUPPORT, Roles.SYSTEM_ENGINEER];
  for (const role of engineerRoles) {
    const { Customer } = getModelsForRole(role);
    const users = await Customer.find();
    for (const user of users) {
      const exists = await EngineerProfile().exists({ userId: user._id });
      if (!exists) {
        await EngineerProfile().create({
          userId: user._id,
          profileCode: user.customerCode,
          name: user.fullName,
          phone: user.phone,
          specialization: role === Roles.SYSTEM_ENGINEER ? "مهندس منظومة" : "دعم فني",
          activeTasks: 0,
          status: "available",
        });
      }
    }
  }
};

const ensureAgentProfiles = async () => {
  const { Customer } = getModelsForRole(Roles.DISTRIBUTOR);
  const users = await Customer.find();
  for (const user of users) {
    const exists = await AgentProfile().exists({ userId: user._id });
    if (!exists) {
      await AgentProfile().create({
        userId: user._id,
        profileCode: user.customerCode,
        name: user.fullName,
        phone: user.phone,
        region: user.address || "",
        balance: 0,
        salesCount: 0,
        todayRefills: 0,
        todayCommission: 0,
        status: user.status === "suspended" ? "suspended" : "active",
      });
    }
  }
};

const ensureAiChatDemoSeed = async () => {
  const Model = CustomerAiChat();
  const count = await Model.countDocuments();
  if (count > 0) return;

  await Model.insertMany([
    {
      sessionCode: "CHAT-1001",
      customerId: "seed-customer-1",
      customerName: "عبد الرحمن الورفلي",
      customerPhone: "091-2345678",
      status: "awaiting_cs",
      aiCategory: "شبكة وإشارة",
      aiSummary: "انقطاع متكرر في الفايبر مع ضوء LOS أحمر على المودم",
      priority: "critical",
      suggestedRoute: "tech_support",
      lastMessageAt: new Date().toISOString(),
      messages: [
        { role: "customer", content: "السلام عليكم، الإنترنت ينقطع كل ساعة والمودم يطلع ضوء أحمر.", createdAt: new Date().toISOString() },
        { role: "assistant", content: "وعليكم السلام. هل الضوء الأحمر على مودم الفايبر الخارجي (ONT)؟", createdAt: new Date().toISOString() },
      ],
    },
    {
      sessionCode: "CHAT-1002",
      customerId: "seed-customer-2",
      customerName: "سارة الترهوني",
      customerPhone: "092-8765432",
      status: "awaiting_cs",
      aiCategory: "بطء سرعة",
      aiSummary: "سرعة التحميل تهبط لأقل من 2 ميجا مساءً",
      priority: "high",
      suggestedRoute: "tech_support",
      lastMessageAt: new Date().toISOString(),
      messages: [
        { role: "customer", content: "السرعة طبيعية الصبح لكن بالليل تصير بطيئة جداً.", createdAt: new Date().toISOString() },
      ],
    },
  ]);
};

const normalizeLegacyCouponCardSerials = async () => {
  const Model = CouponCard();
  const cards = await Model.find({
    $or: [
      { serialNumber: /[^0-9]/ },
      { serialNumber: { $not: new RegExp(`^\\d{${COUPON_CARD_SERIAL_LENGTH}}$`) } },
    ],
  });

  for (const card of cards) {
    const digits = toNumericSerial(card.serialNumber);
    let nextSerial = digits;

    if (!isValidCouponCardSerial(digits)) {
      nextSerial = await nextNumericCode(Model, "serialNumber", COUPON_CARD_SERIAL_LENGTH);
    } else {
      const conflict = await Model.findOne({
        serialNumber: digits,
        _id: { $ne: card._id },
      });
      if (conflict) {
        nextSerial = await nextNumericCode(Model, "serialNumber", COUPON_CARD_SERIAL_LENGTH);
      }
    }

    if (nextSerial !== card.serialNumber) {
      card.serialNumber = nextSerial;
      await card.save();
    }
  }
};

const normalizeLegacyStaffUserCodes = async () => {
  for (const role of STAFF_ROLES) {
    const expectedPrefix = getRoleCodePrefix(role);
    const { Customer } = getModelsForRole(role);
    const users = await Customer.find();
    for (const user of users) {
      const code = String(user.customerCode || "");
      if (code.startsWith(`${expectedPrefix}-`)) continue;

      const newCode = await nextCode(Customer, "customerCode", expectedPrefix);
      user.customerCode = newCode;
      await user.save();
      await AgentProfile().updateOne({ userId: user._id }, { profileCode: newCode });
      await EngineerProfile().updateOne({ userId: user._id }, { profileCode: newCode });
    }
  }
};

class DashboardService {
  static async bootstrap() {
    await Promise.all([ensureAgentProfiles(), ensureEngineerProfiles(), ensureAiChatDemoSeed()]);
    await normalizeLegacyCouponCardSerials();
    await normalizeLegacyStaffUserCodes();

    const { Plan, SupportTicket } = getModelsForRole(Roles.CUSTOMER);
    const [customers, staffUsers, agents, engineers, plans, tickets, cards, reports, logs, permissions, requests, messages, customerAiChats] =
      await Promise.all([
        listCustomers(),
        listStaffUsers(),
        listAgents(),
        listEngineers(),
        Plan.find().sort({ monthlyPrice: 1 }),
        SupportTicket.find().populate("customerId", "fullName phone").sort({ createdAt: -1 }).limit(300),
        CouponCard().find().sort({ createdAt: -1 }).limit(500),
        DailyReport().find().sort({ createdAt: -1 }).limit(200),
        AuditLog().find().sort({ createdAt: -1 }).limit(300),
        SystemPermission().find().sort({ role: 1, module: 1 }),
        AgentRequest().find().sort({ createdAt: -1 }).limit(200),
        InternalMessage().find().sort({ createdAt: -1 }).limit(200),
        CustomerAiChat().find().sort({ updatedAt: -1 }).limit(200),
      ]);

    return {
      customers,
      staffUsers,
      agents,
      engineers,
      plans: plans.map((p) => toDto(p)),
      tickets: tickets.map((t) => toDto(t)),
      cards: cards.map((c) => toDto(c)),
      reports: reports.map((r) => toDto(r)),
      logs: logs.map((l) => toDto(l)),
      permissions: permissions.map((p) => toDto(p)),
      requests: requests.map((r) => toDto(r)),
      messages: messages.map((m) => toDto(m)),
      customerAiChats: customerAiChats.map((c) => toDto(c)),
    };
  }

  static async createAgent(payload) {
    const { Customer } = getModelsForRole(Roles.DISTRIBUTOR);
    const customerCode = await nextCode(Customer, "customerCode", "AGT");
    const password = await EncryptionServices.encryptText(payload.password || "agent12345");
    const user = await Customer.create({
      customerCode,
      fullName: payload.name,
      email: payload.email,
      password,
      phone: payload.phone,
      address: payload.region || "",
      role: Roles.DISTRIBUTOR,
      status: payload.status === "suspended" ? "suspended" : "active",
    });

    const profile = await AgentProfile().create({
      userId: user._id,
      profileCode: customerCode,
      name: payload.name,
      phone: payload.phone,
      region: payload.region || "",
      balance: payload.balance || 0,
      salesCount: payload.salesCount || 0,
      todayRefills: payload.todayRefills || 0,
      todayCommission: payload.todayCommission || 0,
      status: payload.status || "active",
    });

    return { user: toDto(user), profile: toDto(profile) };
  }

  static async updateAgent(id, payload) {
    const profile = await AgentProfile().findById(id);
    if (!profile) throw new NotFoundError("Agent profile not found");

    if (payload.name !== undefined) profile.name = payload.name;
    if (payload.phone !== undefined) profile.phone = payload.phone;
    if (payload.region !== undefined) profile.region = payload.region;
    if (payload.balance !== undefined) profile.balance = payload.balance;
    if (payload.salesCount !== undefined) profile.salesCount = payload.salesCount;
    if (payload.todayRefills !== undefined) profile.todayRefills = payload.todayRefills;
    if (payload.todayCommission !== undefined) profile.todayCommission = payload.todayCommission;
    if (payload.status !== undefined) profile.status = payload.status;
    await profile.save();

    const { Customer } = getModelsForRole(Roles.DISTRIBUTOR);
    await Customer.findByIdAndUpdate(profile.userId, {
      fullName: profile.name,
      phone: profile.phone,
      address: profile.region,
      status: profile.status === "suspended" ? "suspended" : "active",
    });

    return toDto(profile);
  }

  static async deleteAgent(id) {
    const profile = await AgentProfile().findById(id);
    if (!profile) throw new NotFoundError("Agent profile not found");
    const { Customer } = getModelsForRole(Roles.DISTRIBUTOR);
    await Customer.findByIdAndDelete(profile.userId);
    await profile.deleteOne();
    return null;
  }

  static async topUpAgent(id, amount) {
    const profile = await AgentProfile().findById(id);
    if (!profile) throw new NotFoundError("Agent profile not found");
    profile.balance += amount;
    await profile.save();
    return toDto(profile);
  }

  static async createStaffUser(payload) {
    const role = payload.role || Roles.ADMIN;
    const { Customer } = getModelsForRole(role);
    const prefix = getRoleCodePrefix(role);
    const customerCode = await nextCode(Customer, "customerCode", prefix);
    const password = await EncryptionServices.encryptText(payload.password || "staff12345");
    const user = await Customer.create({
      customerCode,
      fullName: payload.name,
      email: payload.email,
      password,
      phone: payload.phone || "",
      address: payload.address || "",
      role,
      status: payload.status || "active",
    });

    if (role === Roles.SUPPORT || role === Roles.SYSTEM_ENGINEER) {
      await EngineerProfile().create({
        userId: user._id,
        profileCode: customerCode,
        name: user.fullName,
        phone: user.phone,
        specialization: role === Roles.SYSTEM_ENGINEER ? "مهندس منظومة" : "دعم فني",
        activeTasks: 0,
        status: "available",
      });
    }

    return toDto(user);
  }

  static async updateStaffUser(id, roleHint, payload) {
    const resolved = await findUserByIdAcrossRoles(id, STAFF_ROLES);
    if (!resolved?.user) throw new NotFoundError("User not found");
    const { Customer } = getModelsForRole(resolved.role);
    const user = await Customer.findByIdAndUpdate(
      resolved.user._id,
      {
        fullName: payload.name ?? resolved.user.fullName,
        phone: payload.phone ?? resolved.user.phone,
        address: payload.address ?? resolved.user.address,
        status: payload.status ?? resolved.user.status,
      },
      { new: true }
    );
    return toDto(user);
  }

  static async deleteStaffUser(id) {
    const resolved = await findUserByIdAcrossRoles(id, STAFF_ROLES);
    if (!resolved?.user) throw new NotFoundError("User not found");
    const { Customer } = getModelsForRole(resolved.role);
    await EngineerProfile().deleteOne({ userId: resolved.user._id });
    await AgentProfile().deleteOne({ userId: resolved.user._id });
    await Customer.findByIdAndDelete(resolved.user._id);
    return null;
  }

  static async generateCards({ value, count }) {
    await normalizeLegacyCouponCardSerials();
    const created = [];
    for (let i = 0; i < count; i += 1) {
      const serialNumber = await nextNumericCode(
        CouponCard(),
        "serialNumber",
        COUPON_CARD_SERIAL_LENGTH
      );
      const pinCode = String(Math.floor(100000 + Math.random() * 900000));
      const card = await CouponCard().create({ serialNumber, pinCode, value, status: "available" });
      created.push(toDto(card));
    }
    return created;
  }

  static async updateCard(id, payload) {
    const card = await CouponCard().findByIdAndUpdate(id, payload, { new: true });
    if (!card) throw new NotFoundError("Card not found");
    return toDto(card);
  }

  static async processAgentRefill(agentId, { amount, customerId, customerName }) {
    const profile = await AgentProfile().findById(agentId);
    if (!profile) throw new NotFoundError("Agent profile not found");
    const value = Number(amount) || 0;
    if (value <= 0) throw new ValidationError("amount must be greater than zero");
    if (profile.balance < value) throw new ValidationError("Insufficient agent balance");

    profile.balance -= value;
    profile.salesCount += 1;
    profile.todayRefills += value;
    profile.todayCommission += value * 0.05;
    await profile.save();

    const log = await DashboardService.createAuditLog({
      timestamp: new Date().toISOString(),
      userRole: "agent",
      userName: profile.name,
      action: "شحن رصيد مباشر للعملاء",
      details: `تم شحن رصيد بقيمة ${value} د.ل للمشترك ${customerName || customerId}`,
      ipAddress: "",
      status: "success",
    });

    return { agent: toDto(profile), log };
  }

  static async createAuditLog(payload) {
    const logCode = await nextCode(AuditLog(), "logCode", "LOG");
    const log = await AuditLog().create({ ...payload, logCode });
    return toDto(log);
  }

  static async upsertPermissions(items) {
    const results = [];
    for (const item of items) {
      const perm = await SystemPermission().findOneAndUpdate(
        { role: item.role, module: item.module },
        item,
        { upsert: true, new: true }
      );
      results.push(toDto(perm));
    }
    return results;
  }

  static async updateRequest(id, payload) {
    const req = await AgentRequest().findByIdAndUpdate(id, payload, { new: true });
    if (!req) throw new NotFoundError("Request not found");
    return toDto(req);
  }

  static async createRequest(payload) {
    const requestCode = await nextCode(AgentRequest, "requestCode", "REQ");
    const item = await AgentRequest().create({ ...payload, requestCode });
    return toDto(item);
  }

  static async updateAiChat(id, payload) {
    const chat = await CustomerAiChat().findByIdAndUpdate(id, payload, { new: true });
    if (!chat) throw new NotFoundError("Chat session not found");
    return toDto(chat);
  }

  static async staffSync(user) {
    const role = user.role;
    const messageFilter = {
      $or: [{ receiverRole: role }, { receiverRole: "all" }, { senderRole: role }],
    };

    const [messages, cards, customerAiChats, logs] = await Promise.all([
      InternalMessage().find(messageFilter).sort({ createdAt: -1 }).limit(100),
      role === "agent" ? CouponCard().find().sort({ createdAt: -1 }).limit(500) : [],
      role === "customer_service" ? CustomerAiChat().find().sort({ updatedAt: -1 }).limit(200) : [],
      AuditLog().find().sort({ createdAt: -1 }).limit(100),
    ]);

    let requests = [];
    if (role === "agent") {
      requests = await AgentRequest().find({ agentId: user.id }).sort({ createdAt: -1 }).limit(100);
    } else if (role === "admin" || role === "system_engineer") {
      requests = await AgentRequest().find().sort({ createdAt: -1 }).limit(100);
    }

    const { SupportTicket } = getModelsForRole(Roles.CUSTOMER);
    const tickets = await SupportTicket.find()
      .populate("customerId", "fullName phone")
      .sort({ createdAt: -1 })
      .limit(200);

    let agents = [];
    if (role === "agent") {
      const profile = await AgentProfile().findOne({ userId: user.id });
      if (profile) agents = [toDto(profile)];
    }

    return {
      messages: messages.map((m) => toDto(m)),
      requests: requests.map((r) => toDto(r)),
      cards: cards.map((c) => toDto(c)),
      customerAiChats: customerAiChats.map((c) => toDto(c)),
      tickets: tickets.map((t) => toDto(t)),
      logs: logs.map((l) => toDto(l)),
      agents,
    };
  }

  static async createMessage(payload) {
    const messageCode = await nextCode(InternalMessage, "messageCode", "MSG");
    const msg = await InternalMessage().create({ ...payload, messageCode });
    return toDto(msg);
  }

  static async markMessageRead(id) {
    const msg = await InternalMessage().findByIdAndUpdate(id, { isRead: true }, { new: true });
    if (!msg) throw new NotFoundError("Message not found");
    return toDto(msg);
  }

  static async seedDefaultPermissions(defaults) {
    if (!defaults?.length) return [];
    const count = await SystemPermission().countDocuments();
    if (count > 0) return SystemPermission().find();
    await SystemPermission().insertMany(defaults);
    return SystemPermission().find();
  }

  static async listPermissions() {
    const perms = await SystemPermission().find().sort({ role: 1, module: 1 });
    return perms.map((p) => toDto(p));
  }
}

export default DashboardService;
