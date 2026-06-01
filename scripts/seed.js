import "dotenv/config";
import mongoose from "mongoose";

import EncryptionServices from "../src/utils/encryptionServices.js";
import { getRoleDb } from "../src/utils/roleDb.js";
import { getCustomerModel } from "../src/modules/customers/customer.model.js";
import { getPlanModel } from "../src/modules/plans/plan.model.js";
import { getDeviceModel } from "../src/modules/devices/device.model.js";
import { getSubscriptionModel } from "../src/modules/subscriptions/subscription.model.js";
import { getPaymentModel } from "../src/modules/payments/payment.model.js";
import { getSupportTicketModel } from "../src/modules/supportTickets/supportTicket.model.js";
import { Roles } from "../src/utils/roles.js";

const DEFAULT_PASSWORD = "admin123";
const CUSTOMER_EMAIL_DOMAIN = "yes.com";

// 1. Better Plans (From data.ts)
const bestPlans = [
  {
    code: "OXY-SLV",
    name: "أوكسجين فضة (Oxygen Silver)",
    speedMbps: 20,
    dataLimitGb: 150,
    monthlyPrice: 45.0,
    vatPercent: 0,
    isActive: true,
    description: "باقة أساسية مناسبة للتصفح اليومي",
  },
  {
    code: "OXY-GLD",
    name: "أوكسجين ذهب سبيد (Oxygen Gold Speed)",
    speedMbps: 50,
    dataLimitGb: 350,
    monthlyPrice: 85.0,
    vatPercent: 0,
    isActive: true,
    description: "الأكثر مبيعاً، مثالية للعائلة",
  },
  {
    code: "OXY-FBR",
    name: "أوكسجين الترا فايبر (Oxygen Ultra Fiber)",
    speedMbps: 100,
    dataLimitGb: 1000, // unlimited basically
    monthlyPrice: 150.0,
    vatPercent: 0,
    isActive: true,
    description: "للهواة وألعاب الأونلاين",
  },
  {
    code: "OXY-BUS",
    name: "أوكسجين أعمال بلس (Oxygen Business Plus)",
    speedMbps: 200,
    dataLimitGb: 2000, // unlimited
    monthlyPrice: 450.0,
    vatPercent: 0,
    isActive: true,
    description: "للشركات والأعمال",
  }
];

// 2. Users by Role (Merged from data.ts & seedData)
const admins = [
  { role: Roles.ADMIN, fullName: "المدير العام", email: "admin@yes.com", phone: "0910000001", address: "طرابلس", status: "active" },
];

const distributors = [
  { role: Roles.DISTRIBUTOR, fullName: "أحمد التاجوري (مركز النور للمكالمات)", email: "agent1@yes.com", phone: "0917766554", address: "طرابلس - سوق الجمعة", status: "active" },
  { role: Roles.DISTRIBUTOR, fullName: "محمد الخراز (أوكسجين فور يو)", email: "agent2@yes.com", phone: "0923344556", address: "بنغازي - الحدائق", status: "active" },
  { role: Roles.DISTRIBUTOR, fullName: "مصطفى قادربوه (اتصالات زليتن)", email: "agent3@yes.com", phone: "0913004005", address: "زليتن - وسط المدينة", status: "active" },
];

const supports = [
  { role: Roles.SUPPORT, fullName: "المهندس وسيم زريق", email: "eng1@yes.com", phone: "0919991112", address: "طرابلس", status: "active" },
  { role: Roles.SUPPORT, fullName: "المهندس مصعب القماطي", email: "eng2@yes.com", phone: "0924445551", address: "بنغازي", status: "active" },
  { role: Roles.SUPPORT, fullName: "المهندسة نورهان العقوري", email: "eng3@yes.com", phone: "0917778889", address: "مصراتة", status: "active" },
];

const customers = [
  { role: Roles.CUSTOMER, customerCode: "CUST-1001", fullName: "عبد الرحمن الورفلي", email: "customer1@yes.com", phone: "0912345678", address: "طرابلس - حي الأندلس", status: "active" },
  { role: Roles.CUSTOMER, customerCode: "CUST-1002", fullName: "سارة الترهوني", email: "customer2@yes.com", phone: "0928765432", address: "بنغازي - الكيش", status: "suspended" }, // expired/suspended
  { role: Roles.CUSTOMER, customerCode: "CUST-1003", fullName: "علي المبروك الشيباني", email: "customer3@yes.com", phone: "0918884433", address: "مصراتة - وسط البلاد", status: "active" },
  { role: Roles.CUSTOMER, customerCode: "CUST-1004", fullName: "فاطمة الزهراء الباعور", email: "customer4@yes.com", phone: "0941122334", address: "الزاوية - السهلة", status: "suspended" },
  { role: Roles.CUSTOMER, customerCode: "CUST-1005", fullName: "خالد الفرجاني", email: "customer5@yes.com", phone: "0925556677", address: "سبها - حي القرضة", status: "active" },
];

const bestUsers = [
  ...admins,
  ...distributors,
  ...supports,
  ...customers
];

const connect = async () => {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.MONGO_DB_NAME;
  if (!mongoUrl || !dbName) {
    throw new Error("Missing MONGO_URL or MONGO_DB_NAME in environment");
  }
  await mongoose.connect(mongoUrl, { dbName });
};

const createCode = (prefix, index) => `${prefix}-${String(index + 1).padStart(4, "0")}`;

const getRoleModels = (role) => {
  const db = getRoleDb(role);
  return {
    Customer: getCustomerModel(db, role),
    Plan: getPlanModel(db),
    Device: getDeviceModel(db),
    Subscription: getSubscriptionModel(db),
    Payment: getPaymentModel(db),
    SupportTicket: getSupportTicketModel(db),
  };
};

const seed = async () => {
  await connect();
  console.log("Connected to MongoDB. Resetting collections...");
  
  const customerModels = getRoleModels(Roles.CUSTOMER);
  const adminModels = getRoleModels(Roles.ADMIN);
  const distributorModels = getRoleModels(Roles.DISTRIBUTOR);
  const supportModels = getRoleModels(Roles.SUPPORT);

  await Promise.all([
    adminModels.Customer.deleteMany({}),
    distributorModels.Customer.deleteMany({}),
    supportModels.Customer.deleteMany({}),
    customerModels.Customer.deleteMany({}),
    customerModels.Plan.deleteMany({}),
    customerModels.Device.deleteMany({}),
    customerModels.Subscription.deleteMany({}),
    customerModels.Payment.deleteMany({}),
    customerModels.SupportTicket.deleteMany({}),
  ]);

  const password = await EncryptionServices.encryptText(DEFAULT_PASSWORD);

  // 1. Insert Plans
  const insertedPlans = [];
  for (const plan of bestPlans) {
    const doc = await customerModels.Plan.create(plan);
    insertedPlans.push(doc);
  }
  console.log(`✅ Inserted ${insertedPlans.length} Plans`);

  // 2. Insert Users
  const insertedCustomers = [];
  
  for (let i = 0; i < bestUsers.length; i++) {
    const u = bestUsers[i];
    const customerCode = u.customerCode || createCode(u.role === Roles.CUSTOMER ? "CUS" : "STF", i + 100);

    const { Customer } = getRoleModels(u.role);
    const doc = await Customer.create({
      customerCode,
      fullName: u.fullName,
      email: u.email,
      password,
      phone: u.phone,
      address: u.address,
      role: u.role,
      status: u.status,
      createdBy: null
    });

    if (u.role === Roles.CUSTOMER) {
      insertedCustomers.push(doc);
    }
  }
  console.log(`✅ Inserted ${bestUsers.length} Users (Admin, Distributors, Support, Customers)`);

  // 3. Insert Subscriptions & Devices for Customers
  let subCount = 0;
  let devCount = 0;
  let invCount = 0;

  for (let i = 0; i < insertedCustomers.length; i++) {
    const customer = insertedCustomers[i];
    const plan = insertedPlans[i % insertedPlans.length];
    
    // Create a device
    const device = await customerModels.Device.create({
      serialNumber: createCode("DEV", i + 500),
      model: i % 2 === 0 ? "MikroTik hAP ax2" : "TP-Link AX55",
      macAddress: `AA:BB:CC:10:20:${String(i + 10).padStart(2, "0")}`,
      firmwareVersion: "7.14",
      ipAddress: `10.10.0.${i + 20}`,
      status: customer.status === "active" ? "online" : "offline",
      customerId: customer._id,
      lastSeenAt: new Date(),
    });
    devCount++;

    // Create a subscription
    const sub = await customerModels.Subscription.create({
      subscriptionNumber: createCode("SUB", i + 200),
      customerId: customer._id,
      planId: plan._id,
      deviceId: device._id,
      status: customer.status,
      assignedIp: `100.64.0.${i + 30}`,
      nextBillingDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20),
      dataUsageGb: 50 + (i * 15),
      notes: "Provisioned automatically by seed script",
    });
    subCount++;

    // Create a payment
    await customerModels.Payment.create({
      invoiceNumber: createCode("INV", i + 600),
      customerId: customer._id,
      subscriptionId: sub._id,
      amount: plan.monthlyPrice,
      vatAmount: 0,
      totalAmount: plan.monthlyPrice,
      currency: "LYD",
      method: i % 2 === 0 ? "card" : "cash",
      status: customer.status === "active" ? "paid" : "pending",
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      paidAt: customer.status === "active" ? new Date() : null,
      periodStart: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
      periodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15),
      note: "فاتورة اشتراك الإنترنت",
    });
    invCount++;
  }

  console.log(`✅ Inserted ${devCount} Devices`);
  console.log(`✅ Inserted ${subCount} Subscriptions`);
  console.log(`✅ Inserted ${invCount} Payments`);

  console.log("-----------------------------------------");
  console.log(`Seed complete successfully!`);
  console.log(`Admin login: admin@yes.com / ${DEFAULT_PASSWORD}`);
  console.log(`Distributor login: agent1@yes.com / ${DEFAULT_PASSWORD}`);
  console.log(`Support login: eng1@yes.com / ${DEFAULT_PASSWORD}`);
  console.log(`Customer login: customer1@yes.com / ${DEFAULT_PASSWORD}`);
};

seed()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("ISP seed failed:", error);
    await mongoose.connection.close();
    process.exit(1);
  });
