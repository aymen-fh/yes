/**
 * Oxygen ISP — قاعدة معرفة أوكسي (FAQ + استكشاف الأعطال).
 */

import { pick, SUPPORT } from "./oxyIntelligence.js";

const formatPlanLine = (p) => {
  const quota = p.isUnlimited || p.dataLimitGb >= 999 ? "غير محدود" : `${p.dataLimitGb} GB`;
  const validity = p.validityLabel ? ` · ${p.validityLabel}` : "";
  return `• ${p.name}: ${p.speedMbps} Mbps · ${quota} · ${p.monthlyPrice} د.ل${validity}`;
};

export const getAvailablePlans = (context = {}) => {
  const plans = context.availablePlans;
  return Array.isArray(plans) ? plans : [];
};

export const answerSlowInternet = (context = {}) => {
  const speed = pick(context, "subscription.plan.speedMbps", "speedMbps");
  const planName = pick(context, "subscription.plan.name", "planName");
  const consumed = pick(context, "usage.consumedGb", "consumedGb");
  const remaining = pick(context, "usage.remainingGb", "remainingGb");
  const isUnlimited = pick(context, "usage.isUnlimited", "isUnlimited") === true;
  const status = pick(context, "subscription.statusLabel", "status");
  const supportPhone = pick(context, "support.phone") || SUPPORT.phone;

  if (status && /موقوف|suspended|cancelled|ملغى/.test(String(status).toLowerCase())) {
    return `⚠️ اشتراكك ${status} — سبب شائع لضعف أو انقطاع الخدمة. راجع «الباقات» أو اتصل ${supportPhone}.`;
  }

  if (!isUnlimited && remaining != null && remaining <= 0.5) {
    return `⚠️ الكota شبه منتهية (متبقي ${remaining} GB). قد تُخفّض السرعة. الحل: شحن أو ترقية من «الباقات».`;
  }

  const steps = [
    "1️⃣ **أعد تشغيل الراوتر** — افصل الكهرباء 30 ثانية.",
    "2️⃣ **استخدم كابل شبكة** أو اقترب من الراوتر — Wi-Fi أضعف.",
    "3️⃣ **أغلق التحميلات الثقيلة** على الأجهزة الأخرى.",
    "4️⃣ **اختبر السرعة** من «الاستهلاك» ← اختبار السرعة.",
    `5️⃣ استمرت المشكلة؟ **بلاغ دعم** أو اتصل ${supportPhone}.`,
  ];

  const planPart =
    planName && speed
      ? `\n\n📦 باقتك: ${planName} (${speed} Mbps). السرعة الفعلية تعتمد على الكables والمسافة وازدحام الشبكة.`
      : "";
  const usagePart =
    !isUnlimited && consumed != null && remaining != null
      ? `\n📊 استهلاكك: ${consumed} GB / ${remaining} GB متبقي.`
      : "";

  return `🔧 **حلول ضعف الإنترنت:**\n${steps.join("\n")}${planPart}${usagePart}`;
};

export const answerWhyFewPlans = (context = {}) => {
  const plans = getAvailablePlans(context);
  const serviceType = pick(context, "subscription.serviceType", "serviceType") || "ftth";
  const planName = pick(context, "subscription.plan.name", "planName");

  const typeLabel = {
    ftth: "الألياف FTTH",
    mobile4g5g: "4G/5G",
    adsl: "ADSL",
    other: "الإنternet",
  }[serviceType] || serviceType;

  let text = `📋 **لماذا الباقات تبدو قليلة؟**\n\n`;
  text += `التطبيق يعرض الباقات **المتاحة لنوع اشتراكك** (${typeLabel}) وليس كل باقات الشركة. `;
  text += `قد تختلف حسب المنطقة ونوع الخدمة.\n\n`;

  if (plans.length > 0) {
    text += `**المتاح لك (${plans.length} باقة):**\n`;
    text += plans.slice(0, 8).map(formatPlanLine).join("\n");
    if (plans.length > 8) text += `\n... و${plans.length - 8} أخرى.`;
    text += `\n\nللترقية: «الباقات».`;
  } else {
    text += `افتح «الباقات» لعرض ما هو متاح.`;
  }

  if (planName) text += `\n\n📦 باقتك الحالية: ${planName}.`;
  text += `\n\n💡 لباقة غير ظاهرة: اتصل ${SUPPORT.phone} أو افتح بلاغ.`;
  return text;
};

export const answerListAllPlans = (context = {}) => {
  const plans = getAvailablePlans(context);
  if (!plans.length) return "افتح «الباقات» لعرض الباقات المتاحة.";

  const limited = plans.filter((p) => !p.isUnlimited && p.dataLimitGb < 999);
  const unlimited = plans.filter((p) => p.isUnlimited || p.dataLimitGb >= 999);

  let text = `📋 **الباقات (${plans.length}):**\n\n`;
  if (limited.length) text += "**محدودة:**\n" + limited.slice(0, 6).map(formatPlanLine).join("\n") + "\n\n";
  if (unlimited.length) text += "**غير محدودة:**\n" + unlimited.slice(0, 4).map(formatPlanLine).join("\n");
  text += `\n\n«الباقات» للترقية.`;
  return text;
};

export const answerNoInternet = (context = {}) => {
  const status = pick(context, "subscription.statusLabel", "status");
  const balance = pick(context, "accountBalance");
  const supportPhone = pick(context, "support.phone") || SUPPORT.phone;

  if (status && /موقوف|suspended/.test(String(status).toLowerCase())) {
    return `❌ الخدمة **${status}**. جدّد من «الباقات» أو شحن الرصيد.`;
  }
  if (balance != null && balance <= 0) {
    return `❌ **لا رصيد** (${balance} د.ل). شحن ← الرئيسية، ثم أعد تشغيل الراوتر.`;
  }

  return `❌ **انقطاع الإنternet:**
1️⃣ تأكد الراوتر يعمل (أضواء خضراء).
2️⃣ أعد تشغيله 30 ثانية.
3️⃣ تحقق اشتراكك «نشط» في التطبيق.
4️⃣ تحقق الكables.
5️⃣ بلاغ دعم أو ${supportPhone}.`;
};

export const answerSpeedLowerThanPlan = (context = {}) => {
  const speed = pick(context, "subscription.plan.speedMbps", "speedMbps");
  const planName = pick(context, "subscription.plan.name", "planName");
  return `⚡ **السرعة أقل من الباقة؟**

باقتك${planName ? ` (${planName})` : ""} حتى ${speed || "؟"} Mbps نظرياً. الفعلية تتأثر بـ: Wi-Fi، المسافة، ازدحام الشبكة، عدد الأجهزة.

**جرّب:** Ethernet، اختبار سرعة من «الاستهلاك»، إعادة تشغيل الراوتر. فرق كبير؟ → بلاغ دعم.`;
};

export const answerWhyExpensive = (context = {}) => {
  const planPrice = pick(context, "subscription.plan.price", "planPrice");
  const planName = pick(context, "subscription.plan.name", "planName");
  const plans = getAvailablePlans(context);
  const cheapest = plans.length ? plans.reduce((a, b) => (a.monthlyPrice < b.monthlyPrice ? a : b)) : null;

  let text = `💰 الأسعار تعكس السرعة والكota ونوع الخدمة والبنية في منطقتك.`;
  if (planName && planPrice != null) text += `\n\nباقتك: ${planName} — ${planPrice} د.ل.`;
  if (cheapest) text += `\nأرخص متاح: ${cheapest.name} (${cheapest.monthlyPrice} د.ل).`;
  text += `\n\nلتوفير: باقة أقل من «الباقات» أو كروت شحن.`;
  return text;
};

export const answerPlanDifference = (context = {}) => {
  const plans = getAvailablePlans(context);
  if (plans.length >= 2) {
    const sorted = [...plans].sort((a, b) => a.monthlyPrice - b.monthlyPrice);
    return `📊 **فرق الباقات:** السرعة + الكota + السعر + المدة.

${formatPlanLine(sorted[0])}
${formatPlanLine(sorted[sorted.length - 1])}

أرخص = تصفح خفيف. أعلى = عائلة وبث. «غير محدود» = بدون حد GB.

«الباقات» للمقارنة الكاملة.`;
  }
  return `📊 الباقات تختلف بالسرعة والكota. باقتك: ${pick(context, "subscription.plan.name", "planName") || "—"}. «الباقات» للمقارنة.`;
};

export const answerTopupFailed = () =>
  `❌ **فشل الشحن:** تحقق PIN، الكرت غير مستخدم، اتصال الإنternet، انتظر دقيقة. استمر؟ احتفظ بالكرت وافتح بلاغ.`;

export const answerCoverage = () =>
  `📡 التغطية تختلف بالمنطقة. اتصل ${SUPPORT.phone} أو «خريطة الوكلاء».`;

export const answerRouterHelp = () =>
  `📶 **الراوتر:** إعادة تشغيل 30 ثانية · أضواء خضراء · Wi-Fi في وسط المنزل · بلاغ دعم لمشاكل hardware.`;

export const FAQ_ENTRIES = [
  { id: "slow_internet", patterns: [/ضعف|ضعيف|بطي|بطء|slow|lag|weak|نت\s*ضعيف|النت\s*بطي|الانترنت\s*بط|الإنترنت\s*بط|سرعة\s*ضعيف|what.*slow/i], answer: answerSlowInternet },
  { id: "why_few_plans", patterns: [/لماذا.*(باق|plan)|ليش.*(باق|plan)|why.*(few|little|only).*plan|باقات\s*قليل|قليل.*باق|ما\s*في\s*باق|plans\s*few|عدد\s*الباقات/i], answer: answerWhyFewPlans },
  { id: "list_plans", patterns: [/(ما|ماهي|اذكر|عرض|list|show|all).*(باق|plan|package)|كم\s*باق|what\s*plans|available\s*plan|الباقات\s*المتاح/i], answer: answerListAllPlans },
  { id: "no_internet", patterns: [/لا\s*يوجد\s*ان|ما\s*في\s*نت|ما\s*شتغل|انقطاع|offline|no\s*internet|not\s*working|disconnect/i], answer: answerNoInternet },
  { id: "speed_lower", patterns: [/سرعة\s*أقل|أقل\s*من\s*الباق|speed\s*lower|not\s*getting\s*speed|why\s*slow.*plan/i], answer: answerSpeedLowerThanPlan },
  { id: "expensive", patterns: [/غالي|expensive|cost|price\s*high|ليش\s*غالي|لماذا\s*السعر|أسعار/i], answer: answerWhyExpensive },
  { id: "plan_diff", patterns: [/فرق\s*(بين\s*)?(الباق|plan)|difference.*plan|أي\s*باق|which\s*plan|أفضل\s*باق|best\s*plan|قارن/i], answer: answerPlanDifference },
  { id: "topup_fail", patterns: [/فشل\s*الشحن|شحن\s*ما\s*نجح|topup\s*fail|recharge\s*fail|الكرت\s*ما\s*اشتغ/i], answer: answerTopupFailed },
  { id: "coverage", patterns: [/تغطية|coverage|منطقت|area|available\s*in/i], answer: answerCoverage },
  { id: "router", patterns: [/راوتر|router|مودم|modem|wifi|واي\s*فاي|الراوتر/i], answer: answerRouterHelp },
];

export const matchFaq = (message) => {
  const q = message.toString();
  for (const entry of FAQ_ENTRIES) {
    if (entry.patterns.some((re) => re.test(q))) return entry;
  }
  return null;
};

export const answerFaq = (message, context = {}) => {
  const entry = matchFaq(message);
  return entry ? entry.answer(context) : null;
};

export default { FAQ_ENTRIES, matchFaq, answerFaq };
