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
    return `⚠️ الكوتا شبه منتهية (متبقي ${remaining} GB). قد تُخفّض السرعة. الحل: شحن أو ترقية من «الباقات».`;
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
      ? `\n\n📦 باقتك: ${planName} (${speed} Mbps). السرعة الفعلية تعتمد على الكابلات والمسافة وازدحام الشبكة.`
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
    other: "الإنترنت",
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

  return `❌ **انقطاع الإنترنت:**
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
    return `📊 **فرق الباقات:** السرعة + الكوتا + السعر + المدة.

${formatPlanLine(sorted[0])}
${formatPlanLine(sorted[sorted.length - 1])}

أرخص = تصفح خفيف. أعلى = عائلة وبث. «غير محدود» = بدون حد GB.

«الباقات» للمقارنة الكاملة.`;
  }
  return `📊 الباقات تختلف بالسرعة والكوتا. باقتك: ${pick(context, "subscription.plan.name", "planName") || "—"}. «الباقات» للمقارنة.`;
};

export const isBestPlanQuestion = (message) => {
  const q = message.toString();
  const hasBest = /أفضل|best|أحسن|احسن|أنسب|recommended|توص/i.test(q);
  const hasPlan = /باق|plan|package|ترق|upgrade/i.test(q);
  const hasOpinion = /را[يأ]ك|رأيك|think|opinion|برأيك|نصيح/i.test(q);
  const notUsage = !/استهلاك|usage|رصيد|balance|شحن|topup/i.test(q);
  if (hasBest && hasPlan) return true;
  if (hasBest && hasOpinion && notUsage) return true;
  if (/توص.*(باق|plan)|which\s*plan.*(best|recommend)/i.test(q)) return true;
  return false;
};

const scorePlanValue = (p) => {
  const unlimited = p.isUnlimited || p.dataLimitGb >= 999;
  const quota = unlimited ? 400 : (p.dataLimitGb || 0);
  return p.speedMbps * 2.5 + quota / 4 - p.monthlyPrice / 6;
};

export const answerBestPlanRecommendation = (context = {}) => {
  const plans = getAvailablePlans(context);
  const currentName = pick(context, "subscription.plan.name", "planName");
  const currentPrice = Number(pick(context, "subscription.plan.price", "planPrice") ?? 0);
  const currentSpeed = Number(pick(context, "subscription.plan.speedMbps", "speedMbps") ?? 0);
  const consumed = Number(pick(context, "usage.consumedGb", "consumedGb") ?? NaN);
  const remaining = Number(pick(context, "usage.remainingGb", "remainingGb") ?? NaN);
  const isUnlimited = pick(context, "usage.isUnlimited", "isUnlimited") === true;
  const quotaTotal = Number(pick(context, "usage.quotaTotalGb", "subscription.plan.quotaGb") ?? NaN);

  if (!plans.length) {
    return `باقتك الحالية: ${currentName || "—"}. افتح «الباقات» لمقارنة الخيارات.`;
  }

  const sorted = [...plans].sort((a, b) => a.monthlyPrice - b.monthlyPrice);
  const cheapest = sorted[0];
  const bestValue = [...plans].sort((a, b) => scorePlanValue(b) - scorePlanValue(a))[0];
  const higherPlans = plans
    .filter((p) => p.monthlyPrice > currentPrice && p.name !== currentName)
    .sort((a, b) => a.monthlyPrice - b.monthlyPrice);

  let upgradeRec = null;
  let downgradeHint = null;
  let usageNote = "";

  if (!isUnlimited && Number.isFinite(consumed) && Number.isFinite(remaining)) {
    const total = quotaTotal > 0 ? quotaTotal : consumed + remaining;
    const usedPct = total > 0 ? Math.round((consumed / total) * 100) : 0;
    usageNote = `📊 استهلاكك: ${consumed} GB / ${remaining} GB متبقي (${usedPct}% مستخدم).\n`;
    if (usedPct >= 65 && higherPlans.length) {
      upgradeRec =
        higherPlans.find((p) => {
          const unlimited = p.isUnlimited || p.dataLimitGb >= 999;
          return unlimited || (p.dataLimitGb || 0) > (quotaTotal || 0);
        }) || higherPlans[0];
    } else if (usedPct <= 25 && currentPrice > cheapest.monthlyPrice * 1.3) {
      downgradeHint = cheapest;
    }
  } else if (isUnlimited) {
    usageNote = "📊 باقتك غير محدودة — مناسبة للاستخدام العالي.\n";
  }

  if (!upgradeRec && currentSpeed > 0 && currentSpeed <= 10 && higherPlans.length) {
    upgradeRec = higherPlans.find((p) => p.speedMbps >= currentSpeed * 1.5) || null;
  }

  let text = "📦 **توصيتي لك:**\n\n";
  text += `**باقتك الحالية:** ${currentName || "—"}`;
  if (currentSpeed) text += ` · ${currentSpeed} Mbps`;
  if (currentPrice) text += ` · ${currentPrice} د.ل`;
  text += "\n";
  if (usageNote) text += `\n${usageNote}`;

  if (upgradeRec) {
    text += `\n⬆️ **أنصحك بالترقية إلى:** ${upgradeRec.name}\n${formatPlanLine(upgradeRec)}\n`;
    text += "_السبب: استهلاكك مرتفع أو باقتك محدودة — ترقية أنسب لك._\n";
  } else if (downgradeHint && downgradeHint.name !== currentName) {
    text += `\n💰 **لتوفير المال:** ${downgradeHint.name}\n${formatPlanLine(downgradeHint)}\n`;
    text += "_السبب: استهلاكك منخفض — باقة أصغر قد تكفيك._\n";
  } else {
    text += "\n✅ **باقتك الحالية مناسبة** لاستهلاكك — لا حاجة للترقية الآن.\n";
  }

  if (bestValue.name !== currentName) {
    text += `\n⭐ **أفضل قيمة (سعر/أداء):** ${bestValue.name}\n${formatPlanLine(bestValue)}\n`;
  }
  if (cheapest.name !== currentName && cheapest.name !== bestValue.name) {
    text += `\n🏷️ **الأرخص:** ${cheapest.name} — ${cheapest.monthlyPrice} د.ل\n`;
  }
  text += "\nللترقية: تبويب «الباقات».";
  return text;
};

export const answerTopupFailed = () =>
  `❌ **فشل الشحن:** تحقق PIN، الكرت غير مستخدم، اتصال الإنترنت، انتظر دقيقة. استمر؟ احتفظ بالكرت وافتح بلاغ.`;

export const answerCoverage = () =>
  `📡 التغطية تختلف بالمنطقة. اتصل ${SUPPORT.phone} أو «خريطة الوكلاء».`;

export const answerRouterHelp = () =>
  `📶 **الراوتر:** إعادة تشغيل 30 ثانية · أضواء خضراء · Wi-Fi في وسط المنزل · بلاغ دعم لمشاكل العتاد.`;

export const answerCableInstallation = (context = {}) => {
  const serviceType = pick(context, "subscription.serviceType", "serviceType") || "ftth";
  const supportPhone = pick(context, "support.phone") || SUPPORT.phone;
  const isFiber = /ftth|fiber|\u0623\u0644\u064a\u0627\u0641|\u0641\u0627\u064a\u0628/i.test(String(serviceType));

  if (isFiber) {
    return `\uD83D\uDD0C **\u062a\u0631\u0643\u064a\u0628 \u0643\u0648\u0627\u0628\u0644 \u0627\u0644\u0625\u0646\u062a\u0631\u0646\u062a (\u0623\u0644\u064a\u0627\u0641 FTTH):**

\u26A0\uFE0F **\u0643\u0627\u0628\u0644 \u0627\u0644\u0623\u0644\u064a\u0627\u0641 \u0627\u0644\u0628\u0635\u0631\u064a** \u062d\u0633\u0627\u0633 \u2014 \u0644\u0627 \u062a\u062b\u0646\u0651\u0650\u0647 \u0628\u0632\u0627\u0648\u064a\u0629 \u062d\u0627\u062f\u0629 \u0648\u0644\u0627 \u062a\u0644\u0645\u0633 \u0631\u0623\u0633\u0647.

**1\uFE0F\u20E3 \u0645\u0646 \u0627\u0644\u062d\u0627\u0626\u0637/\u0627\u0644\u0639\u0644\u0628\u0629 \u0625\u0644\u0649 ONT:**
\u2022 \u0648\u0635\u0651\u0644 \u0643\u0627\u0628\u0644 \u0627\u0644\u0623\u0644\u064a\u0627\u0641 \u0641\u064a \u0645\u0646\u0641\u0630 **PON / OPTICAL**.
\u2022 \u0644\u0627 \u062a\u0646\u0638\u0641 \u0631\u0623\u0633 \u0627\u0644\u0643\u0627\u0628\u0644 \u0628\u0646\u0641\u0633\u0643 \u0625\u0646 \u0643\u0627\u0646 \u0645\u062a\u0633\u062e\u0627\u064b.

**2\uFE0F\u20E3 \u0645\u0646 ONT \u0625\u0644\u0649 \u0627\u0644\u0631\u0627\u0648\u062a\u0631:**
\u2022 \u0643\u0627\u0628\u0644 **Ethernet (RJ45)** \u0645\u0646 **LAN/GE** \u0625\u0644\u0649 **WAN** \u0641\u064a \u0627\u0644\u0631\u0627\u0648\u062a\u0631.
\u2022 \u0627\u062f\u0641\u0639 \u062d\u062a\u0649 \u062a\u0633\u0645\u0639 **\u0637\u0642** \u0648\u064a\u062b\u0628\u062a \u0627\u0644\u0645\u0634\u0628\u0643.

**3\uFE0F\u20E3 \u0645\u0646 \u0627\u0644\u0631\u0627\u0648\u062a\u0631 \u0625\u0644\u0649 \u0627\u0644\u062c\u0647\u0627\u0632 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a):**
\u2022 \u0645\u0646\u0641\u0630 **LAN 1\u20134** \u0625\u0644\u0649 \u0627\u0644\u0643\u0645\u0628\u064a\u0648\u062a\u0631 \u0623\u0648 \u0627\u0644\u062a\u0644\u0641\u0627\u0632\u064a\u0648\u0646.
\u2022 **Cat5e** \u0623\u0648 **Cat6** \u2014 \u0644\u0644\u0633\u0631\u0639\u0627\u062a \u0627\u0644\u0639\u0627\u0644\u064a\u0629 \u064a\u064f\u0641\u0636\u0651\u064e\u0644 Cat6.

**4\uFE0F\u20E3 \u0627\u0644\u062a\u0634\u063a\u064a\u0644:** ONT \u0623\u0648\u0644\u0627\u064b (\u062f\u0642\u064a\u0642\u062a\u0627\u0646) \u2192 \u062b\u0645 \u0627\u0644\u0631\u0627\u0648\u062a\u0631.
\u2022 PON/LOS \u0623\u062e\u0636\u0631 = \u062c\u064a\u062f. \u0623\u062d\u0645\u0631 = \u0628\u0644\u0627\u063a \u062f\u0639\u0645.

**5\uFE0F\u20E3 \u0644\u0627 \u062a\u0641\u0639\u0644:** \u0644\u0627 \u062a\u0642\u0637\u0639 \u0623\u0648 \u062a\u0645\u062f\u0651\u0650\u062f \u0643\u0627\u0628\u0644 \u0627\u0644\u0623\u0644\u064a\u0627\u0641 \u0628\u0646\u0641\u0633\u0643.

\u062a\u0631\u0643\u064a\u0628 \u062c\u062f\u064a\u062f \u0623\u0648 \u0645\u0634\u0643\u0644\u0629\u061f \u0627\u062a\u0635\u0644 **${supportPhone}** \u0623\u0648 \u0628\u0644\u0627\u063a \u062f\u0639\u0645.`;
  }

  return `\uD83D\uDD0C **\u062a\u0631\u0643\u064a\u0628 \u0648\u062a\u0648\u0635\u064a\u0644 \u0643\u0648\u0627\u0628\u0644 \u0627\u0644\u0625\u0646\u062a\u0631\u0646\u062a:**

**1\uFE0F\u20E3 Ethernet (RJ45):** \u0645\u0646\u0641\u0630 **LAN** \u0628\u0627\u0644\u0631\u0627\u0648\u062a\u0631 \u2190 \u062c\u0647\u0627\u0632\u0643. \u0627\u062f\u0641\u0639 \u062d\u062a\u0649 **\u0637\u0642**.
**2\uFE0F\u20E3 WAN:** \u0645\u0646 \u0627\u0644\u0645\u0648\u062f\u0645/ONT \u2190 \u0645\u0646\u0641\u0630 **WAN / Internet** (\u0644\u0648\u0646 \u0645\u062e\u062a\u0644\u0641 \u0639\u0646 LAN).
**3\uFE0F\u20E3 ADSL:** \u062e\u0637 \u0627\u0644\u0647\u0627\u062a\u0641 \u2190 \u0645\u0646\u0641\u0630 **DSL** + splitter \u0625\u0646 \u0644\u0632\u0645.
**4\uFE0F\u20E3** \u062a\u062c\u0646\u0651\u0650\u0628 \u062b\u0646\u064a \u0627\u0644\u0643\u0648\u0627\u0628\u0644. Ethernet \u0623\u0633\u0631\u0639 \u0645\u0646 Wi-Fi. \u0623\u0639\u062f \u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0631\u0627\u0648\u062a\u0631 30 \u062b\u0627\u0646\u064a\u0629.
**5\uFE0F\u20E3** \u062a\u0631\u0643\u064a\u0628 \u0623\u0648\u0644\u061f \u0641\u0646\u064a Oxygen \u2014 **${supportPhone}** \u0623\u0648 \u0628\u0644\u0627\u063a \u062f\u0639\u0645.`;
};

export const answerWhoIsOxy = () =>
  `🤖 **أنا أوكسي OXY** — المساعد الذكي الرسمي لتطبيق Oxygen ISP للموبايل.\n`
  + `أساعدك في: رصيدك، استهلاكك، باقتك، الشحن، سلفني، ضعف النت، والدعم الفني.\n`
  + `لست مساعداً عاماً — أسئلة خارج خدمات Oxygen لا أجيب عنها.`;

export const answerCapabilities = () =>
  `✨ **يمكنني مساعدتك في:**\n`
  + `• 💰 الرصيد والشحن (PIN / QR)\n`
  + `• 📊 الاستهلاك والكوتا وتحليلها\n`
  + `• 📦 الباقات والترقية والتوصيات\n`
  + `• 🔧 ضعف النت وانقطاع الخدمة\n`
  + `• 💳 سلفني (سلفة رصيد)\n`
  + `• 🛠️ الدعم الفني والبلاغات\n`
  + `• 📍 خريطة الوكلاء\n\n`
  + `اسأل مباشرة: «كم رصيدي؟»، «ما رأيك في استهلاكي؟»، «ضعف الإنترنت».`;

export const answerHowToTopup = () =>
  `🔋 **كيفية الشحن:**\n`
  + `1️⃣ الرئيسية ← **شحن الرصيد**\n`
  + `2️⃣ أدخل **PIN** من الكرت أو امسح **QR**\n`
  + `3️⃣ انتظر التأكيد — يظهر الرصيد فوراً\n\n`
  + `💡 فشل الشحن؟ تحقق PIN والاتصال. «سجل المعاملات» للتفاصيل.`;

export const answerPasswordReset = () =>
  `🔐 **استعادة كلمة المرور:**\n`
  + `1️⃣ شاشة الدخول ← **هل نسيت كلمة المرور؟**\n`
  + `2️⃣ أدخل معرفك (رقم الهاتف/العقد)\n`
  + `3️⃣ أدخل **OTP** من SMS\n`
  + `4️⃣ اختر كلمة مرور جديدة\n\n`
  + `لم يصل OTP؟ تحقق الرقم أو اتصل ${SUPPORT.phone}.`;

export const answerChangePlan = (context = {}) => {
  const planName = pick(context, "subscription.plan.name", "planName");
  const part = planName ? `\n\n📦 باقتك الحالية: ${planName}.` : "";
  return `📦 **تغيير الباقة:**\n`
    + `1️⃣ تبويب **«الباقات»** (أسفل الشاشة)\n`
    + `2️⃣ اختر الباقة المناسبة\n`
    + `3️⃣ أكّد الترقية أو التخفيض\n\n`
    + `💡 للتوصية حسب استهلاكك اسأل: «ما أفضل باقة برأيك؟»${part}`;
};

export const answerQuotaExhausted = (context = {}) => {
  const remaining = pick(context, "usage.remainingGb", "remainingGb");
  const planName = pick(context, "subscription.plan.name", "planName");
  if (remaining != null && remaining <= 0) {
    return `⚠️ **الكوتا منتهية** (متبقي ${remaining} GB). السرعة قد تُخفّض.\n`
      + `الحل: شحن رصيد + ترقية من «الباقات»${planName ? ` (باقتك: ${planName})` : ""}.`;
  }
  return `⚠️ **انتهت الكوتا؟** الحل:\n`
    + `• ترقية من «الباقات»\n`
    + `• أو انتظر دورة الفوترة التالية\n`
    + `• أو شحن رصيد إن لزم`;
};

export const answerSpeedTest = () =>
  `⚡ **اختبار السرعة:**\n`
  + `تبويب **«الاستهلاك»** ← اختبار السرعة.\n\n`
  + `💡 للدقة: وصّل كابل Ethernet، أغلق التحميلات، أعد تشغيل الراوتر.`;

export const answerSalfniHelp = (context = {}) => {
  const advance = context.advanceCredit || {};
  const maxRequest = advance.maxRequest;
  if (advance.status === "active" && advance.owedAmount > 0) {
    return `💳 **سلفني:** لديك سلفة ${advance.owedAmount} د.ل — تُخصم تلقائياً عند الشحن التالي.`;
  }
  if (advance.status === "pending") return "⏳ طلب سلفني **قيد المراجعة** — انتظر SMS أو إشعار.";
  if (advance.canRequest && maxRequest) {
    return `💳 **سلفني — سلفة رصيد:**\n`
      + `الخدمات ← **سلفني** ← اطلب حتى **${maxRequest} د.ل**\n`
      + `تُخصم من أول شحن بعد الموافقة.`;
  }
  return `💳 **سلفني:** الخدمات ← **سلفني**. متاح للمشتركين النشطين بدون سلفة معلقة.`;
};

export const answerSupportContact = (context = {}) => {
  const phone = pick(context, "support.phone") || SUPPORT.phone;
  const openTickets = pick(context, "openTicketsCount");
  const ticketPart = openTickets > 0 ? `\n📋 لديك ${openTickets} بلاغ مفتوح — تابع من «سجل البلاغات».` : "";
  return `🛠️ **الدعم الفني:**\n`
    + `• الخدمات ← **الدعم الفني** ← إنشاء بلاغ\n`
    + `• هاتف: **${phone}**\n`
    + `• بريد: ${SUPPORT.email}${ticketPart}`;
};

export const answerHowToComplaint = () =>
  `📝 **فتح بلاغ:**\n`
  + `1️⃣ تبويب **«الخدمات»**\n`
  + `2️⃣ **الدعم الفني** ← صف المشكلة\n`
  + `3️⃣ تابع من **سجل البلاغات**\n\n`
  + `💡 للانقطاع أو ضعف النت: اذكر وقت المشكلة ونوع الراوتر.`;

export const answerAboutOxygen = () =>
  `🌐 **Oxygen** — مزود خدمة إنترنت (ISP) في ليبيا.\n`
  + `نوفر: ألياف FTTH، 4G/5G، ADSL — باقات متنوعة.\n`
  + `التطبيق: شحن، استهلاك، باقات، سلفني، دعم، وكلاء.\n`
  + `للاستفسار: ${SUPPORT.phone}`;

export const answerAppNavigation = (message) => {
  const q = message.toString().toLowerCase();
  if (/شحن|topup|recharge|pin|qr|كرت/.test(q)) return "📍 **شحن الرصيد:** الرئيسية ← شحن الرصيد.";
  if (/استهلاك|usage|كوتا|quota|سرعة|speed\s*test/.test(q)) return "📍 **الاستهلاك:** تبويب «الاستهلاك» (أسفل الشاشة).";
  if (/باق|plan|ترق|upgrade/.test(q)) return "📍 **الباقات:** تبويب «الباقات» (أسفل الشاشة).";
  if (/سلف|advance|salfni/.test(q)) return "📍 **سلفني:** الخدمات ← سلفني.";
  if (/وكيل|agent|map|خريطة/.test(q)) return "📍 **الوكلاء:** الخدمات ← خريطة الوكلاء.";
  if (/دعم|support|بلاغ|ticket|complaint/.test(q)) return "📍 **الدعم:** الخدمات ← الدعم الفني.";
  if (/معامل|transaction|سجل|history/.test(q)) return "📍 **المعاملات:** الرئيسية ← سجل المعاملات.";
  if (/إعداد|setting|لغة|language|theme/.test(q)) return "📍 **الإعدادات:** الرئيسية ← الإعدادات (أيقونة الترس).";
  if (/أوكسي|oxy|مساعد|chat/.test(q)) return "📍 **أوكسي:** الخدمات ← أوكسي OXY.";
  return `📱 **التطبيق — 4 تبويبات:**\n`
    + `• **الرئيسية** — رصيد، شحن، ملخص\n`
    + `• **الخدمات** — سلفني، أوكسي، وكلاء، دعم\n`
    + `• **الاستهلاك** — كوتا واختبار سرعة\n`
    + `• **الباقات** — ترقية وتغيير`;
};

export const answerSubscriptionSuspended = (context = {}) => {
  const status = pick(context, "subscription.statusLabel", "status");
  const balance = pick(context, "accountBalance");
  let text = `⛔ **اشتراك موقوف:**\n`;
  if (status) text += `الحالة: **${status}**.\n`;
  text += `الأسباب الشائعة: انتهاء الباقة، عدم التجديد، رصيد سالب.\n`;
  text += `**الحل:** شحن رصيد ← تجديد من «الباقات».`;
  if (balance != null && balance <= 0) text += `\n💰 رصيدك: ${balance} د.ل — شحن مطلوب.`;
  return text;
};

export const answerUnlimitedVsLimited = () =>
  `📊 **محدودة vs غير محدودة:**\n`
  + `• **محدودة:** كوتا GB محددة + سرعة — أرخص.\n`
  + `• **غير محدودة:** بدون حد GB — للاستخدام العالي والبث.\n\n`
  + `«الباقات» للمقارنة. اسأل «ما أفضل باقة؟» للتوصية.`;

export const answerCancelSubscription = () =>
  `❌ **إلغاء الاشتراك:**\n`
  + `يتطلب التواصل مع الدعم — افتح بلاغ أو اتصل ${SUPPORT.phone}.\n`
  + `جهّز: رقم الاشتراك، الهوية، سبب الإلغاء.`;

export const answerInvoicePayment = (context = {}) => {
  const nextBilling = pick(context, "subscription.nextBillingDate", "nextBillingDate");
  const balance = pick(context, "accountBalance");
  let text = `🧾 **الفواتير والدفع:**\n`
    + `• الشحن: الرئيسية ← شحن الرصيد\n`
    + `• المعاملات: سجل المعاملات\n`
    + `• التجديد التلقائي عند وجود رصيد كافٍ`;
  if (nextBilling) text += `\n📅 موعد التجديد: ${nextBilling}.`;
  if (balance != null) text += `\n💰 رصيدك: ${balance} د.ل.`;
  return text;
};

export const answerWifiPassword = () =>
  `🔑 **كلمة Wi-Fi:**\n`
  + `• ملصق على **الراوتر** (SSID + Password)\n`
  + `• أو إعدادات الراوتر: 192.168.1.1 (حسب الموديل)\n`
  + `• نسيتها؟ اتصل ${SUPPORT.phone} أو بلاغ دعم.`;

export const answerSubscriptionNumber = (context = {}) => {
  const subNumber = pick(context, "subscription.number", "subscriptionNumber");
  if (subNumber) return `📋 **رقم اشتراكك:** ${subNumber}`;
  return `📋 **رقم الاشتراك** في: الرئيسية ← تفاصيل الاشتراك، أو العقد الأصلي.`;
};

export const answerMultipleDevices = () =>
  `📱 **أجهزة متعددة:**\n`
  + `يمكن توصيل عدة أجهزة — السرعة تُقسّم بينها.\n`
  + `💡 للبث والألعاب: باقة أعلى سرعة. Wi-Fi 5GHz أسرع من 2.4GHz.`;

export const answerGamingStreaming = (context = {}) => {
  const plans = getAvailablePlans(context);
  const highSpeed = plans.filter((p) => p.speedMbps >= 16).sort((a, b) => a.monthlyPrice - b.monthlyPrice);
  let text = `🎮 **للألعاب والبث:**\n`
    + `• سرعة 16 Mbps+ موصى بها\n`
    + `• Ethernet أفضل من Wi-Fi\n`
    + `• باقة غير محدودة للبث المكثف`;
  if (highSpeed.length) {
    text += `\n\n**خيارات مناسبة:**\n${highSpeed.slice(0, 3).map(formatPlanLine).join("\n")}`;
  }
  text += `\n\nاسأل «ما أفضل باقة؟» لتوصية شخصية.`;
  return text;
};

export const answerChangePassword = () =>
  `🔐 **تغيير كلمة المرور:** الإعدادات ← الأمان ← تغيير كلمة المرور.\n`
  + `أو «هل نسيت كلمة المرور؟» من شاشة الدخول.`;

export const answerActivation = () =>
  `✅ **تفعيل اشتراك جديد:**\n`
  + `1️⃣ سجّل دخول بالمعرف من العقد\n`
  + `2️⃣ شحن رصيد ← اختيار باقة\n`
  + `3️⃣ انتظر التفعيل (دقائق — ساعات)\n`
  + `متأخر؟ بلاغ دعم أو ${SUPPORT.phone}.`;

export const answerAgentsMap = () =>
  `📍 **خريطة الوكلاء:**\n`
  + `الخدمات ← **خريطة الوكلاء** — مكاتب ونقاط بيع وشحن.\n`
  + `يمكنك عرض التفاصيل والاتجاهات لكل وكيل.`;

export const answerTicketStatus = (context = {}) => {
  const openTickets = pick(context, "openTicketsCount");
  if (openTickets > 0) {
    return `📋 لديك **${openTickets} بلاغ مفتوح**. تابع من: الخدمات ← **سجل البلاغات**.`;
  }
  return `📋 **متابعة البلاغات:** الخدمات ← سجل البلاغات.\nلا بلاغات مفتوحة حالياً — لإنشاء بلاغ: الدعم الفني.`;
};

export const FAQ_ENTRIES = [
  {
    id: "best_plan",
    patterns: [
      /أفضل\s*(باق|plan|package)|best\s*(plan|package)|أحسن\s*(باق|plan)/i,
      /(ما|ماهي|ماهو|what).*(أفضل|best|أحسن|احسن|أنسب)/i,
      /(را[يأ]ك|رأيك|think|opinion|برأيك|توص).*(باق|plan|package|ترق)/i,
      /(باق|plan|package).*(را[يأ]ك|رأيك|أفضل|best|توص)/i,
      /توص.*(باق|plan)|which\s*plan.*(best|recommend)/i,
    ],
    answer: answerBestPlanRecommendation,
  },
  { id: "slow_internet", patterns: [/ضعف|ضعيف|بطي|بطء|slow|lag|weak|نت\s*ضعيف|النت\s*بطي|الانترنت\s*بط|الإنترنت\s*بط|سرعة\s*ضعيف|what.*slow/i], answer: answerSlowInternet },
  { id: "why_few_plans", patterns: [/لماذا.*(باق|plan)|ليش.*(باق|plan)|why.*(few|little|only).*plan|باقات\s*قليل|قليل.*باق|ما\s*في\s*باق|plans\s*few|عدد\s*الباقات/i], answer: answerWhyFewPlans },
  {
    id: "list_plans",
    patterns: [
      /(اذكر|عرض|list|show|all|كل)\s*(الباق|plan|package)|^كم\s*باق|what\s*plans|الباقات\s*المتاح/i,
    ],
    answer: answerListAllPlans,
  },
  { id: "no_internet", patterns: [/لا\s*يوجد\s*ان|ما\s*في\s*نت|ما\s*شتغل|انقطاع|offline|no\s*internet|not\s*working|disconnect/i], answer: answerNoInternet },
  { id: "speed_lower", patterns: [/سرعة\s*أقل|أقل\s*من\s*الباق|speed\s*lower|not\s*getting\s*speed|why\s*slow.*plan/i], answer: answerSpeedLowerThanPlan },
  { id: "expensive", patterns: [/غالي|expensive|cost|price\s*high|ليش\s*غالي|لماذا\s*السعر|أسعار/i], answer: answerWhyExpensive },
  { id: "plan_diff", patterns: [/فرق\s*(بين\s*)?(الباق|plan)|difference.*plan|قارن/i], answer: answerPlanDifference },
  { id: "topup_fail", patterns: [/فشل\s*الشحن|شحن\s*ما\s*نجح|topup\s*fail|recharge\s*fail|الكرت\s*ما\s*اشتغ/i], answer: answerTopupFailed },
  { id: "coverage", patterns: [/تغطية|coverage|منطقت|area|available\s*in/i], answer: answerCoverage },
  { id: "wifi_password", patterns: [/كلمة\s*(ال)?wifi|wifi\s*pass|باسورد\s*الواي|password\s*wifi|شبكة\s*لاسلك/i], answer: answerWifiPassword },
  {
    id: "cable_install",
    patterns: [
      /تركيب.*(كابل|سلك|اسلا|أسلاك|كوابل|انترنت|إنترنت|نت)/i,
      /(كابل|سلك|اسلا|أسلاك|كوابل).*(تركيب|توصيل|ربط|وصل)/i,
      /طريقة.*(تركيب|توصيل).*(كابل|سلك|اسلا|انترنت|إنترنت)/i,
      /cable.*(install|connect|wiring)|ethernet.*(install|connect)/i,
      /وصل.*(كابل|راوتر|ont|مودم)/i,
      /توصيل.*(كابل|اسلا|أسلاك|انترنت)/i,
    ],
    answer: answerCableInstallation,
  },
  { id: "router", patterns: [/راوتر|router|مودم|modem|الراوتر|إعادة\s*تشغيل\s*الر/i], answer: answerRouterHelp },
  { id: "who_oxy", patterns: [/من\s*أنت|من\s*انت|who\s*are\s*you|what\s*is\s*oxy|ما\s*هو\s*أوكس|ما\s*هي\s*أوكس|أوكسي\s*من|مساعد\s*ذك/i], answer: answerWhoIsOxy },
  { id: "capabilities", patterns: [/ماذا\s*يمكن|وش\s*تقدر|what\s*can\s*you|help\s*with|كيف\s*تساعد|ماذا\s*تفعل|تقدر\s*تساعد|خدماتك/i], answer: answerCapabilities },
  { id: "how_topup", patterns: [/كيف\s*(أ|ا)?شحن|how\s*to\s*(topup|recharge)|طريقة\s*الشحن|شحن\s*كيف|أين\s*أشحن|where.*topup/i], answer: answerHowToTopup },
  { id: "password_reset", patterns: [/نسيت\s*كلمة|forgot\s*password|reset\s*password|استعادة\s*كلمة|كلمة\s*المرور\s*نس/i], answer: answerPasswordReset },
  { id: "change_password", patterns: [/تغيير\s*كلمة|change\s*password|بدل\s*كلمة/i], answer: answerChangePassword },
  { id: "change_plan", patterns: [/تغيير\s*(الباق|plan)|change\s*plan|بدل\s*باق|أبدل\s*باق|switch\s*plan/i], answer: answerChangePlan },
  { id: "quota_exhausted", patterns: [/انتهت\s*الكوت|نفذ\s*الاست|خلص\s*النت|quota\s*exhaust|out\s*of\s*data|no\s*data\s*left|الكوتا\s*خلص/i], answer: answerQuotaExhausted },
  { id: "speed_test", patterns: [/اختبار\s*سر|speed\s*test|فحص\s*سر|قياس\s*سر/i], answer: answerSpeedTest },
  { id: "salfni", patterns: [/سلفني|سلف\s*ني|advance\s*credit|سلفة|salfni/i], answer: answerSalfniHelp },
  { id: "support_contact", patterns: [/رقم\s*الدعم|اتصل|contact|phone\s*support|هاتف\s*الدع|support\s*number/i], answer: answerSupportContact },
  { id: "how_complaint", patterns: [/كيف\s*(أ|ا)?فتح\s*بلاغ|how\s*to\s*complaint|open\s*ticket|إنشاء\s*بلاغ|رفع\s*بلاغ/i], answer: answerHowToComplaint },
  { id: "about_oxygen", patterns: [/ما\s*هي\s*oxygen|what\s*is\s*oxygen|عن\s*oxygen|عن\s*أوكس|شركة\s*oxygen|من\s*هي\s*oxygen/i], answer: answerAboutOxygen },
  { id: "app_nav", patterns: [/أين\s*أجد|وين\s*ال|where\s*(is|find)|كيف\s*أوصل|فين\s*ال|أين\s*(شحن|باق|استه|سلف|دعم|وكيل)/i], answer: answerAppNavigation },
  { id: "suspended", patterns: [/موقوف|suspended|معلق|تعليق\s*الخدم|خدمة\s*موقوف/i], answer: answerSubscriptionSuspended },
  { id: "unlimited_limited", patterns: [/غير\s*محدود|unlimited|محدود\s*و\s*غير|فرق\s*محدود/i], answer: answerUnlimitedVsLimited },
  { id: "cancel", patterns: [/إلغاء\s*اش|cancel\s*sub|الغاء\s*الاش|إنهاء\s*اش/i], answer: answerCancelSubscription },
  { id: "invoice", patterns: [/فاتورة|invoice|bill|دفع|payment|سداد/i], answer: answerInvoicePayment },
  { id: "sub_number", patterns: [/رقم\s*الاش|subscription\s*number|رقم\s*اشتراك/i], answer: answerSubscriptionNumber },
  { id: "multi_device", patterns: [/أجهزة\s*مت|عدة\s*أجه|multiple\s*device|more\s*than\s*one\s*device/i], answer: answerMultipleDevices },
  { id: "gaming", patterns: [/ألعاب|gaming|game|بث|stream|netflix|youtube\s*4k/i], answer: answerGamingStreaming },
  { id: "activation", patterns: [/تفعيل|activate|اشتراك\s*جديد|new\s*sub/i], answer: answerActivation },
  { id: "agents_map", patterns: [/خريطة\s*الو|وكلاء|agents?\s*map|nearest\s*agent|أقرب\s*وكيل/i], answer: answerAgentsMap },
  { id: "ticket_status", patterns: [/حالة\s*البل|متابعة\s*بل|ticket\s*status|بلاغاتي|سجل\s*البل/i], answer: answerTicketStatus },
];

export const matchFaq = (message) => {
  const q = message.toString();
  if (isBestPlanQuestion(q)) {
    return FAQ_ENTRIES.find((e) => e.id === "best_plan") ?? { answer: answerBestPlanRecommendation };
  }
  for (const entry of FAQ_ENTRIES) {
    if (entry.patterns.some((re) => re.test(q))) return entry;
  }
  return null;
};

export const answerFaq = (message, context = {}) => {
  const entry = matchFaq(message);
  return entry ? entry.answer(context) : null;
};

export const isKnownTopic = (message) => Boolean(matchFaq(message));

export default { FAQ_ENTRIES, matchFaq, answerFaq, isKnownTopic, isBestPlanQuestion };
