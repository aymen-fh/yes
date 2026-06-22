import EncryptionServices from "../../utils/encryptionServices.js";
import { NotFoundError } from "../../utils/errors.js";
import { Roles, STAFF_ROLES } from "../../utils/roles.js";
import { findUserByIdAcrossRoles, getModelsForRole } from "../../utils/roleModels.js";
import { createReadableCode, serializeDoc } from "../common/serializers.js";
import {
  AgentProfile,
  EngineerProfile,
  CouponCard,
  DailyReport,
  AuditLog,
  SystemPermission,
  AgentRequest,
  InternalMessage,
} from "./dashboard.models.js";

const nextCode = async (Model, field, prefix) => {
  for (let i = 0; i < 8; i += 1) {
    const code = createReadableCode(prefix);
    const exists = await Model().exists({ [field]: code });
    if (!exists) return code;
  }
  return `${createReadableCode(prefix)}-${Date.now().toString().slice(-4)}`;
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
  const profiles = await AgentProfile().find().sort({ createdAt: -1 });
  return profiles.map((p) => toDto(p));
};

const listEngineers = async () => {
  const profiles = await EngineerProfile().find().sort({ createdAt: -1 });
  return profiles.map((p) => toDto(p));
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

class DashboardService {
  static async bootstrap() {
    await Promise.all([ensureAgentProfiles(), ensureEngineerProfiles()]);

    const { Plan, SupportTicket } = getModelsForRole(Roles.CUSTOMER);
    const [customers, staffUsers, agents, engineers, plans, tickets, cards, reports, logs, permissions, requests, messages] =
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
    const prefix = role === Roles.DISTRIBUTOR ? "AGT" : "USR";
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
    const created = [];
    for (let i = 0; i < count; i += 1) {
      const serialNumber = await nextCode(CouponCard(), "serialNumber", "CRD");
      const pinCode = String(Math.floor(100000 + Math.random() * 900000));
      const card = await CouponCard().create({ serialNumber, pinCode, value, status: "available" });
      created.push(toDto(card));
    }
    return created;
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

  static async createMessage(payload) {
    const msg = await InternalMessage().create(payload);
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
}

export default DashboardService;
