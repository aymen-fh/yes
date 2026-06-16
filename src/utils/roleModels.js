import { Roles } from "./roles.js";
import { getRoleDb } from "./roleDb.js";
import { getCustomerModel } from "../modules/customers/customer.model.js";
import { getPlanModel } from "../modules/plans/plan.model.js";
import { getDeviceModel } from "../modules/devices/device.model.js";
import { getSubscriptionModel } from "../modules/subscriptions/subscription.model.js";
import { getPaymentModel } from "../modules/payments/payment.model.js";
import { getSupportTicketModel } from "../modules/supportTickets/supportTicket.model.js";
import { getServicePointModel } from "../modules/servicePoints/servicePoint.model.js";
import { getUsageDailyModel } from "../modules/usage/usageDaily.model.js";
import { getSpeedTestModel } from "../modules/speedTests/speedTest.model.js";

const roleModelsCache = new Map();

const buildModels = (db, role) => ({
  Customer: getCustomerModel(db, role),
  Plan: getPlanModel(db),
  Device: getDeviceModel(db),
  Subscription: getSubscriptionModel(db),
  Payment: getPaymentModel(db),
  SupportTicket: getSupportTicketModel(db),
  ServicePoint: getServicePointModel(db),
  UsageDaily: getUsageDailyModel(db),
  SpeedTest: getSpeedTestModel(db),
});

export const getModelsForRole = (role) => {
  const safeRole = role || Roles.CUSTOMER;
  if (roleModelsCache.has(safeRole)) {
    return roleModelsCache.get(safeRole);
  }

  const db = getRoleDb(safeRole);
  const models = buildModels(db, safeRole);
  roleModelsCache.set(safeRole, models);
  return models;
};

export const getCustomerDomainModels = () => getModelsForRole(Roles.CUSTOMER);

export const findUserByIdAcrossRoles = async (id, roles = Object.values(Roles)) => {
  for (const role of roles) {
    const { Customer } = getModelsForRole(role);
    const user = await Customer.findById(id);
    if (user) {
      return { user, role };
    }
  }

  return null;
};

export const findUserByIdentifierAcrossRoles = async (identifier, roles = Object.values(Roles)) => {
  if (!identifier) return null;

  const isEmail = identifier.includes("@");
  const query = isEmail
    ? { email: identifier.toLowerCase().trim() }
    : { customerCode: identifier.toUpperCase().trim() };

  for (const role of roles) {
    const { Customer } = getModelsForRole(role);
    const user = await Customer.findOne(query);
    if (user) {
      return { user, role };
    }
  }

  return null;
};
