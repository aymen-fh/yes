import "dotenv/config";
import mongoose from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

import EncryptionServices from "../src/utils/encryptionServices.js";
import { getRoleDb } from "../src/utils/roleDb.js";
import { getCustomerModel } from "../src/modules/customers/customer.model.js";
import { getPlanModel } from "../src/modules/plans/plan.model.js";
import { getDeviceModel } from "../src/modules/devices/device.model.js";
import { getSubscriptionModel } from "../src/modules/subscriptions/subscription.model.js";
import { getPaymentModel } from "../src/modules/payments/payment.model.js";
import { getSupportTicketModel } from "../src/modules/supportTickets/supportTicket.model.js";
import { getServicePointModel } from "../src/modules/servicePoints/servicePoint.model.js";
import { getUsageDailyModel } from "../src/modules/usage/usageDaily.model.js";
import { getSpeedTestModel } from "../src/modules/speedTests/speedTest.model.js";
import SupportTicketService from "../src/modules/supportTickets/supportTicket.service.js";
import { Roles, getRoleCodePrefix } from "../src/utils/roles.js";

const DEFAULT_PASSWORD = "admin123";
const CUSTOMER_EMAIL_DOMAIN = "yes.com";

// Mobile + FTTH plan catalogue
const bestPlans = [
  { code: "LIM-05", name: "5 دينار", speedMbps: 16, dataLimitGb: 5, monthlyPrice: 5, durationDays: 5, validityLabel: "5 أيام", isUnlimited: false, isActive: true },
  { code: "LIM-10", name: "10 دينار", speedMbps: 10, dataLimitGb: 10, monthlyPrice: 10, durationDays: 10, validityLabel: "10 أيام", isUnlimited: false, isActive: true },
  { code: "LIM-25", name: "25 دينار", speedMbps: 10, dataLimitGb: 25, monthlyPrice: 25, durationDays: 25, validityLabel: "25 يوم", isUnlimited: false, isActive: true },
  { code: "LIM-30", name: "30 دينار", speedMbps: 16, dataLimitGb: 45, monthlyPrice: 30, durationDays: 30, validityLabel: "شهر", isUnlimited: false, isActive: true },
  { code: "LIM-45", name: "45 دينار", speedMbps: 12, dataLimitGb: 55, monthlyPrice: 45, durationDays: 27, validityLabel: "27 يوم", isUnlimited: false, isActive: true },
  { code: "LIM-55", name: "55 دينار", speedMbps: 16, dataLimitGb: 80, monthlyPrice: 55, durationDays: 30, validityLabel: "شهر", isUnlimited: false, isActive: true },
  { code: "LIM-60", name: "60 دينار", speedMbps: 20, dataLimitGb: 115, monthlyPrice: 60, durationDays: 30, validityLabel: "شهر", isUnlimited: false, isActive: true },
  { code: "LIM-65", name: "65 دينار", speedMbps: 20, dataLimitGb: 155, monthlyPrice: 65, durationDays: 30, validityLabel: "شهر", isUnlimited: false, isActive: true },
  { code: "LIM-75", name: "75 دينار", speedMbps: 20, dataLimitGb: 160, monthlyPrice: 75, durationDays: 30, validityLabel: "شهر", isUnlimited: false, isActive: true },
  { code: "LIM-80", name: "80 دينار", speedMbps: 5, dataLimitGb: 400, monthlyPrice: 80, durationDays: 30, validityLabel: "شهر", isUnlimited: false, isActive: true },
  { code: "LIM-95", name: "95 دينار", speedMbps: 20, dataLimitGb: 250, monthlyPrice: 95, durationDays: 30, validityLabel: "شهر", isUnlimited: false, isActive: true },
  { code: "UNL-21", name: "21 دينار", speedMbps: 6, dataLimitGb: 999, monthlyPrice: 21, durationDays: 7, validityLabel: "7 أيام", isUnlimited: true, isActive: true },
  { code: "UNL-40", name: "40 دينار", speedMbps: 7, dataLimitGb: 999, monthlyPrice: 40, durationDays: 14, validityLabel: "14 يوم", isUnlimited: true, isActive: true },
  { code: "UNL-55", name: "55 دينار", speedMbps: 2, dataLimitGb: 999, monthlyPrice: 55, durationDays: 30, validityLabel: "شهر", isUnlimited: true, isActive: true },
  { code: "UNL-75", name: "75 دينار", speedMbps: 7, dataLimitGb: 999, monthlyPrice: 75, durationDays: 30, validityLabel: "شهر", isUnlimited: true, isActive: true },
  { code: "UNL-98", name: "98 دينار", speedMbps: 8, dataLimitGb: 999, monthlyPrice: 98, durationDays: 30, validityLabel: "شهر", isUnlimited: true, isActive: true },
  { code: "UNL-105", name: "105 دينار", speedMbps: 12, dataLimitGb: 999, monthlyPrice: 105, durationDays: 30, validityLabel: "شهر", isUnlimited: true, isActive: true },
  { code: "OXY-SLV", name: "أوكسجين فضة (Oxygen Silver)", speedMbps: 20, dataLimitGb: 150, monthlyPrice: 45, durationDays: 30, validityLabel: "شهر", isUnlimited: false, isActive: true, description: "باقة أساسية مناسبة للتصفح اليومي" },
  { code: "OXY-GLD", name: "أوكسجين ذهب سبيد (Oxygen Gold Speed)", speedMbps: 50, dataLimitGb: 350, monthlyPrice: 85, durationDays: 30, validityLabel: "شهر", isUnlimited: false, isActive: true, description: "الأكثر مبيعاً، مثالية للعائلة" },
  { code: "OXY-FBR", name: "أوكسجين الترا فايبر (Oxygen Ultra Fiber)", speedMbps: 100, dataLimitGb: 1000, monthlyPrice: 150, durationDays: 30, validityLabel: "شهر", isUnlimited: true, isActive: true, description: "للهواة وألعاب الأونلاين" },
  { code: "OXY-BUS", name: "أوكسجين أعمال بلس (Oxygen Business Plus)", speedMbps: 200, dataLimitGb: 2000, monthlyPrice: 450, durationDays: 30, validityLabel: "شهر", isUnlimited: true, isActive: true, description: "للشركات والأعمال" },
];

const SERVICE_TYPES = ["ftth", "mobile4g5g", "adsl"];
const BRANCH_NAMES = ["فرع طرابلس - بن عاشور", "فرع بنغازي - الكيش", "فرع مصراتة", "فرع الزاوية", "فرع سبها"];

const admins = [
  { role: Roles.ADMIN, fullName: "مسعود الغنودي", email: "admin@yes.com", phone: "0910000001", address: "طرابلس", status: "active" },
];

const distributors = [
  { role: Roles.DISTRIBUTOR, fullName: "علي كريم (بئر الغنم)", email: "agent1@yes.com", phone: "0917766554", address: "بئر الغنم", status: "active" },
  { role: Roles.DISTRIBUTOR, fullName: "علي المريمي (رقدالين)", email: "agent2@yes.com", phone: "0923344556", address: "رقدالين", status: "active" },
];

const supports = [
  { role: Roles.SUPPORT, fullName: "مهندس معتصم شيوب", email: "tech1@yes.com", phone: "0919991112", address: "طرابلس", status: "active" },
];

const sysEngineers = [
  { role: Roles.SYSTEM_ENGINEER, fullName: "مهندسة هديل العلي", email: "syseng1@yes.com", phone: "0921112223", address: "طرابلس", status: "active" },
];

const customerServices = [
  { role: Roles.CUSTOMER_SERVICE, fullName: "مهندسة دعاء محمد", email: "cs1@yes.com", phone: "0941112223", address: "طرابلس", status: "active" },
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
  ...sysEngineers,
  ...customerServices,
  ...customers
];

const connect = async () => {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.MONGO_DB_NAME;
  if (!mongoUrl || !dbName) {
    throw new Error("Missing MONGO_URL or MONGO_DB_NAME in environment");
  }
  
  let retries = 5;
  while (retries > 0) {
    try {
      await mongoose.connect(mongoUrl, { dbName });
      return;
    } catch (err) {
      console.log(`Connection failed. Retrying... (${retries} left)`);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
  throw new Error("Failed to connect to MongoDB after multiple retries");
};

const createCode = (prefix, index) => `${prefix}-${String(index + 1).padStart(4, "0")}`;

const startOfDay = (input = new Date()) => {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
};

const seedDailyUsage = async (UsageDaily, subscriptionId, totalGb) => {
  const weights = [0.75, 0.95, 1.15, 0.85, 1.05, 0.9, 1.35];
  const sum = weights.reduce((acc, value) => acc + value, 0);

  for (let offset = 0; offset < 7; offset += 1) {
    const day = startOfDay(new Date());
    day.setDate(day.getDate() - (6 - offset));

    await UsageDaily.create({
      subscriptionId,
      date: day,
      usageGb: Number(((totalGb * weights[offset]) / sum).toFixed(2)),
    });
  }
};

const getRoleModels = (role) => {
  const db = getRoleDb(role);
  return {
    Customer: getCustomerModel(db, role),
    Plan: getPlanModel(db),
    Device: getDeviceModel(db),
    Subscription: getSubscriptionModel(db),
    Payment: getPaymentModel(db),
    SupportTicket: getSupportTicketModel(db),
    ServicePoint: getServicePointModel(db),
    UsageDaily: getUsageDailyModel(db),
    SpeedTest: getSpeedTestModel(db),
  };
};

const seed = async () => {
  await connect();
  console.log("Connected to MongoDB. Resetting collections...");
  
  const customerModels = getRoleModels(Roles.CUSTOMER);
  const adminModels = getRoleModels(Roles.ADMIN);
  const distributorModels = getRoleModels(Roles.DISTRIBUTOR);
  const supportModels = getRoleModels(Roles.SUPPORT);
  const sysEngModels = getRoleModels(Roles.SYSTEM_ENGINEER);
  const csModels = getRoleModels(Roles.CUSTOMER_SERVICE);

  await Promise.all([
    adminModels.Customer.deleteMany({}),
    distributorModels.Customer.deleteMany({}),
    supportModels.Customer.deleteMany({}),
    sysEngModels.Customer.deleteMany({}),
    csModels.Customer.deleteMany({}),
    customerModels.Customer.deleteMany({}),
    customerModels.Plan.deleteMany({}),
    customerModels.Device.deleteMany({}),
    customerModels.Subscription.deleteMany({}),
    customerModels.Payment.deleteMany({}),
    customerModels.SupportTicket.deleteMany({}),
    customerModels.ServicePoint.deleteMany({}),
    customerModels.UsageDaily.deleteMany({}),
    customerModels.SpeedTest.deleteMany({}),
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
  let insertedSupportUser = null;
  
  for (let i = 0; i < bestUsers.length; i++) {
    const u = bestUsers[i];
    const customerCode = u.customerCode || createCode(getRoleCodePrefix(u.role), i + 100);

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
    if (u.role === Roles.SUPPORT && !insertedSupportUser) {
      insertedSupportUser = doc;
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
    const isUnlimitedPlan = plan.isUnlimited || plan.dataLimitGb >= 999;
    const usageRatio = 0.35 + ((i % 4) * 0.12);
    const dataUsageGb = isUnlimitedPlan
      ? Number((40 + i * 12).toFixed(2))
      : Number(Math.min(plan.dataLimitGb * usageRatio, plan.dataLimitGb * 0.95).toFixed(2));

    const sub = await customerModels.Subscription.create({
      subscriptionNumber: createCode("SUB", i + 200),
      customerId: customer._id,
      planId: plan._id,
      deviceId: device._id,
      status: customer.status,
      serviceType: SERVICE_TYPES[i % SERVICE_TYPES.length],
      branchName: BRANCH_NAMES[i % BRANCH_NAMES.length],
      assignedIp: `100.64.0.${i + 30}`,
      nextBillingDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20),
      dataUsageGb,
      notes: "Provisioned automatically by seed script",
    });
    subCount++;

    await seedDailyUsage(customerModels.UsageDaily, sub._id, sub.dataUsageGb);

    await customerModels.SpeedTest.create({
      subscriptionId: sub._id,
      customerId: customer._id,
      pingMs: 12 + i,
      downloadMbps: plan.speedMbps * 0.92,
      uploadMbps: plan.speedMbps * 0.28,
      testedAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    });

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

    if (i === 0) {
      await customerModels.Payment.create({
        invoiceNumber: createCode("INV", i + 900),
        customerId: customer._id,
        subscriptionId: sub._id,
        amount: 45,
        vatAmount: 0,
        totalAmount: 45,
        currency: "LYD",
        method: "wallet",
        status: "paid",
        dueDate: new Date(),
        paidAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24),
        note: "Topup via scratch code 45LYD",
      });
      invCount++;
    }
  }

  console.log(`✅ Inserted ${devCount} Devices`);
  console.log(`✅ Inserted ${subCount} Subscriptions`);
  console.log(`✅ Inserted ${invCount} Payments`);

  // 4. Service points for mobile map
  const servicePoints = [
    {
      name: "مكتب Oxygen - بن عاشور",
      address: "طرابلس، بن عاشور، شارع الجمهورية",
      type: "office",
      latitude: 32.8798,
      longitude: 13.1876,
      phone: "0912345678",
      workingHours: "9:00 ص - 5:00 م",
    },
    {
      name: "وكيل معتمد - سوق الجمعة",
      address: "طرابلس، سوق الجمعة، بالقرب من المسجد الكبير",
      type: "agent",
      latitude: 32.8624,
      longitude: 13.2311,
      phone: "0923456789",
      workingHours: "10:00 ص - 6:00 م",
    },
    {
      name: "نقطة بيع - عين زارة",
      address: "طرابلس، عين زارة، شارع الأمل",
      type: "salesPoint",
      latitude: 32.8365,
      longitude: 13.2044,
      phone: "0934567890",
      workingHours: "9:30 ص - 4:30 م",
    },
    {
      name: "مكتب Oxygen - قرقارش",
      address: "طرابلس، قرقارش، شارع البحر",
      type: "office",
      latitude: 32.9012,
      longitude: 13.1755,
      phone: "0945678901",
      workingHours: "9:00 ص - 5:00 م",
    },
    {
      name: "وكيل معتمد - تاجوراء",
      address: "طرابلس، تاجوراء، شارع المطار",
      type: "agent",
      latitude: 32.8811,
      longitude: 13.2689,
      phone: "0956789012",
      workingHours: "10:00 ص - 7:00 م",
    },
    {
      name: "نقطة بيع - السراج",
      address: "طرابلس، السراج، شارع النصر",
      type: "salesPoint",
      latitude: 32.9156,
      longitude: 13.1588,
      phone: "0967890123",
      workingHours: "11:00 ص - 5:00 م",
    },
  ];

  await customerModels.ServicePoint.insertMany(servicePoints);
  console.log(`✅ Inserted ${servicePoints.length} Service Points`);

  // 5. Sample support tickets for first customer
  if (insertedCustomers.length > 0) {
    const customer = insertedCustomers[0];
    const customerSub = await customerModels.Subscription.findOne({ customerId: customer._id });
    if (customerSub) {
      const ticketNumber = await SupportTicketService.createTicketNumber();
      await customerModels.SupportTicket.create({
        ticketNumber,
        customerId: customer._id,
        subscriptionId: customerSub._id,
        subject: "انقطاع الإنترنت مساءً",
        description: "الإنترنت ينقطع بشكل متكرر بعد الساعة 8 مساءً",
        category: "technical",
        priority: "medium",
        status: "in_progress",
        replies: [
          {
            authorId: customer._id,
            authorRole: "customer",
            message: "الإنترنت ينقطع بشكل متكرر بعد الساعة 8 مساءً",
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
          },
          ...(insertedSupportUser
            ? [{
                authorId: insertedSupportUser._id,
                authorRole: "tech_support",
                message: "تم استلام بلاغك وجاري فحص الخط في منطقتك",
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
              }]
            : []),
        ],
      });
      console.log("✅ Inserted sample support ticket");
    }
  }

  console.log("-----------------------------------------");
  console.log(`Seed complete successfully!`);
  console.log(`Admin login: admin@yes.com / ${DEFAULT_PASSWORD}`);
  console.log(`Agent login: agent1@yes.com / ${DEFAULT_PASSWORD}`);
  console.log(`Tech Support login: tech1@yes.com / ${DEFAULT_PASSWORD}`);
  console.log(`Sys Eng login: syseng1@yes.com / ${DEFAULT_PASSWORD}`);
  console.log(`Customer Service login: cs1@yes.com / ${DEFAULT_PASSWORD}`);
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
