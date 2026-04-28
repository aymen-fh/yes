import "dotenv/config";
import mongoose from "mongoose";

import EncryptionServices from "../src/utils/encryptionServices.js";
import CustomerModel from "../src/modules/customers/customer.model.js";
import PlanModel from "../src/modules/plans/plan.model.js";
import DeviceModel from "../src/modules/devices/device.model.js";
import SubscriptionModel from "../src/modules/subscriptions/subscription.model.js";
import PaymentModel from "../src/modules/payments/payment.model.js";

const DEFAULT_PASSWORD = "admin123";
const DEFAULT_ADMIN_EMAIL = "admin@yes.com";
const CUSTOMER_EMAIL_DOMAIN = "yes.com";

const defaultPlans = [
  {
    code: "BASIC25",
    name: "Basic 25 Mbps",
    speedMbps: 25,
    dataLimitGb: 300,
    monthlyPrice: 18,
    vatPercent: 15,
    isActive: true,
    description: "Entry package for browsing and HD streaming",
    features: ["Static IP optional", "24/7 ticket support"],
  },
  {
    code: "PLUS60",
    name: "Plus 60 Mbps",
    speedMbps: 60,
    dataLimitGb: 800,
    monthlyPrice: 32,
    vatPercent: 15,
    isActive: true,
    description: "Best for families and smart home setups",
    features: ["Priority support", "Free router replacement"],
  },
  {
    code: "PRO120",
    name: "Pro 120 Mbps",
    speedMbps: 120,
    dataLimitGb: 1800,
    monthlyPrice: 52,
    vatPercent: 15,
    isActive: true,
    description: "High-speed package for power users",
    features: ["Low latency profile", "Business hour SLA"],
  },
];

const names = [
  "Mina Fahmy",
  "Sara Adel",
  "Kareem Emad",
  "Lina Samir",
  "Youssef Nabil",
  "Nada Hassan",
  "Ahmed Tarek",
  "Mariam Fathy",
  "Omar Khaled",
  "Heba Mostafa",
];

const parseCount = () => {
  const parsed = Number.parseInt(process.argv[2] || "8", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
};

const shouldReset = () => process.argv.includes("--reset");
const shouldResetAdmin = () => process.argv.includes("--reset-admin");

const createCode = (prefix, index) => `${prefix}-${String(index + 1).padStart(4, "0")}`;

const connect = async () => {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.MONGO_DB_NAME;

  if (!mongoUrl || !dbName) {
    throw new Error("Missing MONGO_URL or MONGO_DB_NAME in environment");
  }

  await mongoose.connect(mongoUrl, { dbName });
};

const ensureAdmin = async ({ resetAdmin = false } = {}) => {
  const existing = await CustomerModel.findOne({ role: "admin" });

  const password = await EncryptionServices.encryptText(DEFAULT_PASSWORD);

  if (existing) {
    existing.email = DEFAULT_ADMIN_EMAIL;
    existing.fullName = "Oxygen Admin";
    existing.customerCode = "CUS-000001";
    existing.password = password;
    existing.status = "active";
    existing.phone = existing.phone || "+201000000001";
    existing.address = existing.address || "Cairo";
    await existing.save();
    return existing;
  }

  return CustomerModel.create({
    customerCode: "CUS-000001",
    fullName: "Oxygen Admin",
    email: DEFAULT_ADMIN_EMAIL,
    password,
    phone: "+201000000001",
    address: "Cairo",
    role: "admin",
    status: "active",
  });
};

const upsertPlans = async () => {
  const planIds = [];

  for (const plan of defaultPlans) {
    const doc = await PlanModel.findOneAndUpdate({ code: plan.code }, plan, {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
    });

    planIds.push(doc._id);
  }

  return planIds;
};

const ensureCustomer = async (index, adminId) => {
  const fullName = names[index % names.length];
  const email = `customer${index + 1}@${CUSTOMER_EMAIL_DOMAIN}`;
  const customerCode = createCode("CUS", index + 10);
  const phone = `+20100000${String(index + 1).padStart(3, "0")}`;
  const status = index % 5 === 0 ? "pending" : "active";
  const password = await EncryptionServices.encryptText(DEFAULT_PASSWORD);

  let customer = await CustomerModel.findOne({
    $or: [{ email }, { customerCode }],
  });

  if (customer) {
    customer.fullName = fullName;
    customer.email = email;
    customer.customerCode = customerCode;
    customer.password = password;
    customer.phone = phone;
    customer.address = "Alexandria";
    customer.role = "customer";
    customer.status = status;
    customer.createdBy = customer.createdBy || adminId;
    await customer.save();
    return customer;
  }

  customer = await CustomerModel.create({
    customerCode,
    fullName,
    email,
    password,
    phone,
    address: "Alexandria",
    role: "customer",
    status,
    createdBy: adminId,
  });

  return customer;
};

const ensureDevice = async (index, customerId) => {
  const serialNumber = createCode("DEV", index + 100);
  const macAddress = `AA:BB:CC:${String(index + 10).padStart(2, "0")}:${String(index + 11).padStart(2, "0")}:${String(index + 12).padStart(2, "0")}`;

  return DeviceModel.findOneAndUpdate(
    { serialNumber },
    {
      serialNumber,
      model: index % 2 === 0 ? "MikroTik hAP ax2" : "TP-Link AX55",
      macAddress,
      firmwareVersion: index % 2 === 0 ? "7.14" : "1.1.4",
      ipAddress: `10.10.0.${index + 20}`,
      status: index % 3 === 0 ? "offline" : "online",
      customerId,
      lastSeenAt: new Date(),
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );
};

const ensureSubscription = async (index, customerId, planId, deviceId) => {
  const subscriptionNumber = createCode("SUB", index + 200);

  return SubscriptionModel.findOneAndUpdate(
    { subscriptionNumber },
    {
      subscriptionNumber,
      customerId,
      planId,
      deviceId,
      status: index % 4 === 0 ? "pending" : "active",
      assignedIp: `100.64.0.${index + 30}`,
      nextBillingDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20),
      dataUsageGb: 50 + (index % 6) * 25,
      notes: "Provisioned from seed script",
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );
};

const ensurePayment = async (index, customerId, subscriptionId, planPrice) => {
  const invoiceNumber = createCode("INV", index + 600);
  const vatAmount = Number((planPrice * 0.15).toFixed(2));
  const totalAmount = Number((planPrice + vatAmount).toFixed(2));

  return PaymentModel.findOneAndUpdate(
    { invoiceNumber },
    {
      invoiceNumber,
      customerId,
      subscriptionId,
      amount: planPrice,
      vatAmount,
      totalAmount,
      currency: "USD",
      method: index % 2 === 0 ? "card" : "cash",
      status: index % 3 === 0 ? "pending" : "paid",
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      paidAt: index % 3 === 0 ? null : new Date(),
      periodStart: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
      periodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15),
      note: "Auto-generated invoice",
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );
};

const resetCollections = async () => {
  await Promise.all([
    CustomerModel.deleteMany({ role: { $ne: "admin" } }),
    PlanModel.deleteMany({}),
    DeviceModel.deleteMany({}),
    SubscriptionModel.deleteMany({}),
    PaymentModel.deleteMany({}),
  ]);
};

const seed = async () => {
  const count = parseCount();
  const reset = shouldReset();
  const resetAdmin = shouldResetAdmin();

  await connect();
  if (reset) {
    await resetCollections();
    console.log("Existing ISP records have been cleared (admin kept if exists). ");
  }

  const admin = await ensureAdmin({ resetAdmin });
  const planIds = await upsertPlans();
  const plans = await PlanModel.find({ _id: { $in: planIds } }).sort({ monthlyPrice: 1 });

  for (let index = 0; index < count; index += 1) {
    const customer = await ensureCustomer(index, admin._id);
    const plan = plans[index % plans.length];
    const device = await ensureDevice(index, customer._id);
    const subscription = await ensureSubscription(index, customer._id, plan._id, device._id);

    await ensurePayment(index, customer._id, subscription._id, plan.monthlyPrice);
  }

  console.log(`Seed complete. Admin login: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_PASSWORD}`);
  if (resetAdmin) {
    console.log("Admin credentials were reset using --reset-admin.");
  }
  console.log(`Created or updated ${count} customer records with linked ISP data.`);
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

const isoDaysAgo = (days) => {
  const now = Date.now();
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
};

export const seedData = {
  users: [
    {
      id: 'u_admin_1',
      fullName: 'المدير العام',
      email: 'admin@yes.com',
      password: 'admin123',
      role: 'admin',
      status: 'active',
      phone: '0910000001',
      region: 'طرابلس',
      createdAt: isoDaysAgo(250),
    },
    {
      id: 'u_distributor_1',
      fullName: 'وكيل معتمد - طرابلس',
      email: 'distributor@yes.com',
      password: 'admin123',
      role: 'distributor',
      status: 'active',
      phone: '0910000002',
      region: 'طرابلس',
      createdAt: isoDaysAgo(190),
    },
    {
      id: 'u_support_1',
      fullName: 'موظف خدمة العملاء',
      email: 'support@yes.com',
      password: 'admin123',
      role: 'support',
      status: 'active',
      phone: '0910000003',
      region: 'بنغازي',
      createdAt: isoDaysAgo(140),
    },
    {
      id: 'u_agent_1',
      fullName: 'وكيل طرابلس',
      email: 'agent@yes.com',
      password: 'admin123',
      role: 'agent',
      status: 'active',
      phone: '0910000004',
      region: 'طرابلس',
      createdAt: isoDaysAgo(120),
    },
    {
      id: 'u_engineer_1',
      fullName: 'م. أحمد علي',
      email: 'engineer@yes.com',
      password: 'admin123',
      role: 'engineer',
      status: 'active',
      phone: '0910000005',
      region: 'مصراتة',
      createdAt: isoDaysAgo(110),
    },
    {
      id: 'u_customer_1',
      fullName: 'محمد خالد',
      email: 'customer1@yes.com',
      password: 'admin123',
      role: 'customer',
      status: 'active',
      phone: '0921112233',
      region: 'طرابلس',
      createdAt: isoDaysAgo(80),
    },
    {
      id: 'u_customer_2',
      fullName: 'سارة النعاس',
      email: 'customer2@yes.com',
      password: 'admin123',
      role: 'customer',
      status: 'pending',
      phone: '0922223344',
      region: 'بنغازي',
      createdAt: isoDaysAgo(60),
    },
    {
      id: 'u_customer_3',
      fullName: 'يوسف الورفلي',
      email: 'customer3@yes.com',
      password: 'admin123',
      role: 'customer',
      status: 'suspended',
      phone: '0923334455',
      region: 'سبها',
      createdAt: isoDaysAgo(30),
    },
  ],

  customers: [
    {
      id: 'c_0001',
      customerCode: 'CUS-0001',
      fullName: 'محمد خالد',
      email: 'customer1@yes.com',
      phone: '0921112233',
      address: 'حي الاندلس - طرابلس',
      role: 'customer',
      status: 'active',
      createdAt: isoDaysAgo(80),
    },
    {
      id: 'c_0002',
      customerCode: 'CUS-0002',
      fullName: 'سارة النعاس',
      email: 'customer2@yes.com',
      phone: '0922223344',
      address: 'الكيش - بنغازي',
      role: 'customer',
      status: 'pending',
      createdAt: isoDaysAgo(60),
    },
    {
      id: 'c_0003',
      customerCode: 'CUS-0003',
      fullName: 'يوسف الورفلي',
      email: 'customer3@yes.com',
      phone: '0923334455',
      address: 'المهدية - سبها',
      role: 'customer',
      status: 'suspended',
      createdAt: isoDaysAgo(30),
    },
  ],

  plans: [
    {
      id: 'p_10',
      code: 'PLN-10',
      name: 'باقة اقتصادية',
      speedMbps: 10,
      monthlyPrice: 50,
      dataLimitGb: 120,
      durationMonths: 1,
      vatPercent: 15,
      isActive: true,
      createdAt: isoDaysAgo(120),
    },
    {
      id: 'p_50',
      code: 'PLN-50',
      name: 'باقة مميزة',
      speedMbps: 50,
      monthlyPrice: 100,
      dataLimitGb: 300,
      durationMonths: 1,
      vatPercent: 15,
      isActive: true,
      createdAt: isoDaysAgo(115),
    },
    {
      id: 'p_100',
      code: 'PLN-100',
      name: 'باقة اعمال',
      speedMbps: 100,
      monthlyPrice: 250,
      dataLimitGb: 700,
      durationMonths: 1,
      vatPercent: 15,
      isActive: true,
      createdAt: isoDaysAgo(110),
    },
  ],

  subscriptions: [
    {
      id: 's_0001',
      subscriptionNumber: 'SUB-2026-0001',
      customerId: 'c_0001',
      planId: 'p_50',
      status: 'active',
      startDate: isoDaysAgo(20),
      endDate: isoDaysAgo(-10),
      createdAt: isoDaysAgo(20),
    },
    {
      id: 's_0002',
      subscriptionNumber: 'SUB-2026-0002',
      customerId: 'c_0002',
      planId: 'p_10',
      status: 'pending',
      startDate: isoDaysAgo(5),
      endDate: isoDaysAgo(25),
      createdAt: isoDaysAgo(5),
    },
    {
      id: 's_0003',
      subscriptionNumber: 'SUB-2026-0003',
      customerId: 'c_0003',
      planId: 'p_100',
      status: 'suspended',
      startDate: isoDaysAgo(45),
      endDate: isoDaysAgo(15),
      createdAt: isoDaysAgo(45),
    },
  ],

  payments: [
    {
      id: 'inv_0001',
      invoiceNumber: 'INV-2026-0001',
      customerId: 'c_0001',
      subscriptionId: 's_0001',
      amount: 100,
      vatAmount: 15,
      totalAmount: 115,
      currency: 'LYD',
      status: 'paid',
      method: 'card',
      dueDate: isoDaysAgo(10),
      paidAt: isoDaysAgo(9),
      createdAt: isoDaysAgo(20),
    },
    {
      id: 'inv_0002',
      invoiceNumber: 'INV-2026-0002',
      customerId: 'c_0002',
      subscriptionId: 's_0002',
      amount: 50,
      vatAmount: 7.5,
      totalAmount: 57.5,
      currency: 'LYD',
      status: 'pending',
      method: 'cash',
      dueDate: isoDaysAgo(2),
      createdAt: isoDaysAgo(8),
    },
    {
      id: 'inv_0003',
      invoiceNumber: 'INV-2026-0003',
      customerId: 'c_0003',
      subscriptionId: 's_0003',
      amount: 250,
      vatAmount: 37.5,
      totalAmount: 287.5,
      currency: 'LYD',
      status: 'pending',
      method: 'bank_transfer',
      dueDate: isoDaysAgo(15),
      createdAt: isoDaysAgo(25),
    },
  ],

  reports: [
    {
      id: 'r_0001',
      authorName: 'وكيل طرابلس',
      authorRole: 'agent',
      content: 'تمت 12 عملية تعبئة وبيع 7 كروت خلال الوردية الصباحية.',
      createdAt: isoDaysAgo(1),
    },
    {
      id: 'r_0002',
      authorName: 'م. أحمد علي',
      authorRole: 'engineer',
      content: 'تم تركيب 3 وصلات جديدة ومعالجة شكوتين في حي الاندلس.',
      createdAt: isoDaysAgo(2),
    },
    {
      id: 'r_0003',
      authorName: 'وكيل معتمد - طرابلس',
      authorRole: 'distributor',
      content: 'ارتفاع الطلب على باقة 50 ميجا بنسبة 18% خلال هذا الاسبوع.',
      createdAt: isoDaysAgo(3),
    },
  ],

  complaints: [
    {
      id: 't_0001',
      customerName: 'محمد خالد',
      subject: 'انقطاع الخدمة',
      description: 'الانترنت ينقطع من الساعة 9 مساء.',
      status: 'processing',
      createdAt: isoDaysAgo(2),
      updatedAt: isoDaysAgo(1),
      solution: '',
    },
    {
      id: 't_0002',
      customerName: 'سارة النعاس',
      subject: 'بطء في التحميل',
      description: 'السرعة اقل من المتوقع في وقت الذروة.',
      status: 'pending',
      createdAt: isoDaysAgo(1),
      updatedAt: isoDaysAgo(1),
      solution: '',
    },
    {
      id: 't_0003',
      customerName: 'يوسف الورفلي',
      subject: 'مشكلة في الراوتر',
      description: 'الراوتر يعيد التشغيل تلقائيا.',
      status: 'solved',
      createdAt: isoDaysAgo(7),
      updatedAt: isoDaysAgo(4),
      solution: 'تم تحديث السوفتوير واستبدال المحول الكهربائي.',
    },
  ],

  competitors: [
    { id: 'cmp_1', name: 'شركة المدار', price: 120, speed: '20 Mbps', status: 'cheaper', change: -5 },
    { id: 'cmp_2', name: 'شركة ليبيا للاتصالات', price: 150, speed: '25 Mbps', status: 'same', change: 0 },
    { id: 'cmp_3', name: 'شركة هاتف ليبيا', price: 180, speed: '30 Mbps', status: 'expensive', change: 10 },
    { id: 'cmp_4', name: 'شركة الوطنية نت', price: 140, speed: '22 Mbps', status: 'same', change: 1 },
  ],

  cards: [
    { id: 'card_1', code: '1234-5678-9012', value: 10, status: 'available', createdAt: isoDaysAgo(14) },
    { id: 'card_2', code: '9876-5432-1098', value: 20, status: 'available', createdAt: isoDaysAgo(14) },
    { id: 'card_3', code: '5555-7777-8888', value: 50, status: 'used', usedBy: 'محمد خالد', usedAt: isoDaysAgo(1), createdAt: isoDaysAgo(20) },
  ],

  installations: [
    {
      id: 'inst_1',
      customerName: 'محمد خالد',
      address: 'حي الاندلس - طرابلس',
      status: 'pending',
      assignedTo: '',
      createdAt: isoDaysAgo(2),
    },
    {
      id: 'inst_2',
      customerName: 'سارة النعاس',
      address: 'الكيش - بنغازي',
      status: 'assigned',
      assignedTo: 'م. أحمد علي',
      createdAt: isoDaysAgo(4),
    },
  ],
};
