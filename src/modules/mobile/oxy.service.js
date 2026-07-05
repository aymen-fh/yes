/**
 * OXY (أوكسي) — مساعد Oxygen الذكي المحدود النطاق.
 * يقرأ بيانات المشترك ويجيب فقط ضمن نطاق Oxygen ISP.
 */

const OXY_SYSTEM_PROMPT = `أنت "أوكسي OXY"، المساعد الذكي الرسمي لتطبيق Oxygen ISP في ليبيا — متاح فقط داخل تطبيق الموبايل.

## دورك
- مساعد شخصي للمشترك: أجب عن اشتراكه، رصيده، استهلاكه، باقته، سلفني، الوكلاء، والدعم الفني.
- استخدم بيانات المشترك المرفقة في السياق (JSON) كمصدر الحقيقة الوحيد للأرقام والتواريخ.
- إذا لم تتوفر بيانات في السياق، لا تخترع أرقاماً — وجّه المستخدم للشاشة المناسبة في التطبيق.

## قواعد صارمة
1. أجب فقط عن Oxygen ISP وخدمات التطبيق (اشتراك، شحن، باقات، استهلاك، سلفني، وكلاء، دعم، OTP، تسجيل دخول).
2. إذا سُئلت عن موضوع خارج Oxygen (رياضة، سياسة، برمجة، أخبار، طقس...) قل بلطف: "أنا أوكسي، مساعد Oxygen فقط. كيف أساعدك في خدمة الإنترنت؟"
3. لا تذكر Gemini أو Google أو أي مزود AI — أنت أوكسي من Oxygen.
4. استخدم العربية الفصحى البسيطة، قصيراً (2-4 جمل)، واضحاً وودوداً.
5. عند السؤال عن رصيد/استهلاك/باقة/تاريخ تجديد — استخدم الأرقام من السياق مباشرة.`;

const IN_SCOPE_KEYWORDS = [
  "oxygen", "oxy", "أوكسي", "أوكسجين", "أكسجين",
  "اشتراك", "subscription", "باقة", "باقات", "plan", "plans", "package",
  "شحن", "topup", "recharge", "رصيد", "balance", "رصيدي", "فلوس",
  "سلفني", "سلف", "advance", "credit",
  "وكيل", "وكلاء", "agent", "agents", "map", "خريطة", "مكتب", "office",
  "دعم", "support", "help", "بلاغ", "تذكرة", "ticket", "complaint", "مشكل",
  "استهلاك", "usage", "quota", "كوتا", "data", "جيجا", "gb", "متبقي", "consumption",
  "فاتورة", "invoice", "bill", "كرت", "card", "pin", "qr",
  "انترنت", "إنترنت", "internet", "wifi", "سرعة", "speed",
  "تجديد", "renew", "ترقية", "upgrade", "تطبيق", "app",
  "otp", "رمز", "تحقق", "login", "دخول", "password", "كلمة",
  "مرحبا", "مرحباً", "hello", "hi", "اهلا", "أهلا", "السلام",
  "كم", "متى", "أين", "كيف", "وش", "ايش", "ليش", "لماذا", "حالة", "وضع",
  "حساب", "account", "اشتراكي", "باقتي", "استهلاكي",
];

const OUT_OF_SCOPE_HINTS = [
  "messi", "ronaldo", "football", "كرة القدم", "رياضة", "sport",
  "سياسة", "politics", "برمجة", "coding", "python", "javascript",
  "طقس", "weather", "أخبار", "news", "فيلم", "movie", "مسلسل",
  "gpt", "chatgpt", "gemini", "openai",
];

const ACCOUNT_QUESTION_HINTS = [
  "رصيد", "balance", "استهلاك", "usage", "باق", "plan", "متبقي",
  "تجديد", "renew", "billing", "فاتورة", "سلف", "اشتراك", "حالة", "وضع",
  "كم", "متى", "history", "معامل", "transaction", "تذكرة", "ticket",
];

const isInScope = (message) => {
  const normalized = message.toString().toLowerCase().trim();
  if (!normalized) return true;
  if (OUT_OF_SCOPE_HINTS.some((kw) => normalized.includes(kw))) return false;
  if (IN_SCOPE_KEYWORDS.some((kw) => normalized.includes(kw))) return true;
  if (ACCOUNT_QUESTION_HINTS.some((kw) => normalized.includes(kw))) return true;
  return false;
};

const formatContextBlock = (context = {}) => {
  if (!context || typeof context !== "object") return "";
  try {
    return JSON.stringify(context, null, 2);
  } catch {
    return String(context);
  }
};

const pick = (ctx, ...paths) => {
  for (const path of paths) {
    const parts = path.split(".");
    let cur = ctx;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") {
        cur = undefined;
        break;
      }
      cur = cur[p];
    }
    if (cur != null && cur !== "") return cur;
  }
  return null;
};

const dataAwareFallbackReply = (message, context = {}) => {
  const q = message.toString().toLowerCase().trim();

  if (!isInScope(message)) {
    return "أنا أوكسي OXY، مساعد Oxygen فقط داخل تطبيق الموبايل. اسألني عن اشتراكك، الشحن، الباقات، الاستهلاك، سلفني، أو الدعم الفني.";
  }

  if (/^(hi|hello)$/.test(q) || q.includes("مرحب") || q.includes("اهلا") || q.includes("أهلا") || q.includes("السلام")) {
    const name = pick(context, "customer.name");
    const greeting = name ? `مرحباً ${name}! ` : "مرحباً! ";
    return `${greeting}أنا أوكسي، مساعد Oxygen. اسألني عن رصيدك، استهلاكك، باقتك، الشحن، سلفني، الوكلاء، أو الدعم الفني.`;
  }

  const planName = pick(context, "subscription.plan.name", "planName");
  const statusLabel = pick(context, "subscription.statusLabel", "status");
  const balance = pick(context, "accountBalance");
  const consumed = pick(context, "usage.consumedGb");
  const remaining = pick(context, "usage.remainingGb");
  const isUnlimited = pick(context, "usage.isUnlimited", "subscription.plan.isUnlimited");
  const nextBilling = pick(context, "subscription.nextBillingDate", "nextBillingDate");
  const subNumber = pick(context, "subscription.number", "subscriptionNumber");
  const speed = pick(context, "subscription.plan.speedMbps", "speedMbps");
  const planPrice = pick(context, "subscription.plan.price", "planPrice");
  const advance = context.advanceCredit || {};
  const openTickets = pick(context, "openTicketsCount");
  const supportPhone = pick(context, "support.phone") || "19000";

  if (
    q.includes("رصيد") ||
    q.includes("balance") ||
    (q.includes("كم") && (q.includes("فلوس") || q.includes("رصيد") || q.includes("حساب")))
  ) {
    if (balance != null) {
      return `رصيد حسابك الحالي: ${balance} د.ل. لشحن الرصيد: الرئيسية ← شحن الرصيد.`;
    }
    return "لمعرفة رصيدك: الرئيسية ← شحن الرصيد، أو اسألني بعد تحميل بيانات اشتراكك.";
  }

  if (
    q.includes("استهلاك") ||
    q.includes("usage") ||
    q.includes("كوتا") ||
    q.includes("quota") ||
    q.includes("جيجا") ||
    q.includes("gb") ||
    (q.includes("متبقي") && (q.includes("انترنت") || q.includes("إنترنت") || q.includes("data") || q.includes("بيانات")))
  ) {
    if (isUnlimited === true) {
      return `باقتك${planName ? ` (${planName})` : ""} غير محدودة الاستهلاك. لمتابعة التفاصيل: تبويب «الاستهلاك».`;
    }
    if (consumed != null && remaining != null) {
      return `استهلاكك: ${consumed} GB. المتبقي: ${remaining} GB${planName ? ` (باقة ${planName})` : ""}. التفاصيل في تبويب «الاستهلاك».`;
    }
    return "متابعة الاستهلاك من تبويب «الاستهلاك» — يظهر المستهلك والمتبقي وتاريخ إعادة الضبط.";
  }

  if (
    q.includes("باق") ||
    q.includes("plan") ||
    q.includes("package") ||
    q.includes("سرعة") ||
    q.includes("speed")
  ) {
    const parts = [];
    if (planName) parts.push(`باقتك: ${planName}`);
    if (speed) parts.push(`السرعة: ${speed} Mbps`);
    if (planPrice) parts.push(`السعر: ${planPrice} د.ل/شهر`);
    if (isUnlimited === true) parts.push("استهلاك غير محدود");
    else if (remaining != null) parts.push(`متبقي: ${remaining} GB`);
    if (parts.length) {
      return `${parts.join(". ")}. لإدارة الباقة: تبويب «الباقات».`;
    }
    return "لإدارة باقتك: تبويب «الباقات» يعرض الباقة الحالية والمتاحة للترقية أو التجديد.";
  }

  if (
    q.includes("تجديد") ||
    q.includes("renew") ||
    q.includes("فاتورة") ||
    q.includes("billing") ||
    (q.includes("متى") && (q.includes("ينته") || q.includes("تنته") || q.includes("فاتورة")))
  ) {
    if (nextBilling) {
      return `موعد التجديد/الفاتورة القادمة: ${nextBilling}${planName ? ` (باقة ${planName})` : ""}. للتجديد المبكر: تبويب «الباقات».`;
    }
    return "لمعرفة موعد التجديد: تبويب «الباقات» أو «الاستهلاك» يعرض تاريخ انتهاء الدورة.";
  }

  if (q.includes("حالة") || q.includes("وضع") || q.includes("status")) {
    if (statusLabel || subNumber) {
      const statusPart = statusLabel ? `الحالة: ${statusLabel}` : "";
      const numPart = subNumber ? `رقم الاشتراك: ${subNumber}` : "";
      return [statusPart, numPart].filter(Boolean).join(". ") + ".";
    }
  }

  if (q.includes("سلف") || q.includes("سلفني") || q.includes("advance") || q.includes("credit")) {
    if (advance.status === "active" && advance.owedAmount > 0) {
      return `لديك سلفة نشطة بقيمة ${advance.owedAmount} د.ل. ستُخصم تلقائياً عند الشحن التالي.`;
    }
    if (advance.status === "pending") {
      return "طلب سلفني قيد المراجعة. انتظر الموافقة أو راجع الخدمات ← سلفني.";
    }
    if (advance.canRequest && advance.maxRequest) {
      return `يمكنك طلب سلفة حتى ${advance.maxRequest} د.ل من الخدمات ← سلفني.`;
    }
    return "خدمة سلفني: الخدمات ← سلفني. اختر المبلغ وستُخصم السلفة عند الشحن التالي.";
  }

  if (q.includes("شحن") || q.includes("كرت") || q.includes("pin") || q.includes("topup") || q.includes("recharge") || q.includes("qr")) {
    return "لشحن اشتراكك: الرئيسية ← شحن الرصيد، أدخل رمز الكرت أو امسح QR. ستصلك رسالة تأكيد فور النجاح.";
  }

  if (q.includes("ترقية") || q.includes("upgrade")) {
    return "لترقية باقتك: تبويب «الباقات» ← اختر الباقة الأعلى ← تأكيد الترقية.";
  }

  if (q.includes("وكيل") || q.includes("agent") || q.includes("خريطة") || q.includes("map") || q.includes("مكتب")) {
    return "للعثور على وكيل قريب: الخدمات ← خريطة الوكلاء. اختر النقطة لعرض التفاصيل والاتصال والاتجاهات.";
  }

  if (q.includes("دعم") || q.includes("support") || q.includes("help") || q.includes("بلاغ") || q.includes("تذكرة") || q.includes("ticket") || q.includes("مشكل")) {
    const ticketPart =
      openTickets != null && openTickets > 0
        ? ` لديك ${openTickets} بلاغ/تذكرة مفتوحة.`
        : "";
    return `لفتح بلاغ: الخدمات ← الدعم الفني ← إنشاء بلاغ.${ticketPart} أو اتصل ${supportPhone}.`;
  }

  if (q.includes("otp") || q.includes("رمز") || q.includes("تحقق") || q.includes("دخول") || q.includes("login") || q.includes("password") || q.includes("كلمة")) {
    return "لتسجيل الدخول: أدخل المعرف وكلمة المرور من عقد الاشتراك. سيصلك OTP عبر SMS. لاستعادة كلمة المرور: «هل نسيت كلمة المرور؟».";
  }

  if (q.includes("معامل") || q.includes("transaction") || q.includes("عمليات") || q.includes("سجل")) {
    const txs = context.latestTransactions;
    if (Array.isArray(txs) && txs.length > 0) {
      const summary = txs
        .slice(0, 3)
        .map((t) => `${t.amount} د.ل (${t.status})${t.date ? ` — ${t.date}` : ""}`)
        .join("؛ ");
      return `آخر العمليات: ${summary}. التفاصيل الكاملة في تبويب الشحن/المعاملات.`;
    }
    return "سجل المعاملات متاح من الشاشة الرئيسية أو تبويب الشحن.";
  }

  const planPart = planName ? `باقتك: ${planName}. ` : "";
  const statusPart = statusLabel ? `الحالة: ${statusLabel}. ` : "";
  return `${planPart}${statusPart}أنا أوكسي. اسألني عن رصيدك، استهلاكك، الباقة، الشحن، سلفني، الوكلاء، أو الدعم.`;
};

const callGemini = async (message, history, context) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const contextBlock = formatContextBlock(context);
  const contextPrompt = contextBlock
    ? `\n\n--- بيانات المشترك (استخدمها للإجابة، لا تخترع خارجها) ---\n${contextBlock}\n--- نهاية البيانات ---`
    : "";

  const contents = [
    ...(history || []).slice(-10).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    })),
    {
      role: "user",
      parts: [{ text: `${message}${contextPrompt}` }],
    },
  ];

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: OXY_SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 600,
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.warn(`[OXY] Gemini HTTP ${response.status}: ${details.slice(0, 240)}`);
    return null;
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return text || null;
};

const mergeContext = (serverContext = {}, clientContext = {}) => ({
  ...clientContext,
  ...serverContext,
  subscription: {
    ...(clientContext.subscription || {}),
    ...(serverContext.subscription || {}),
    plan: {
      ...(clientContext.subscription?.plan || {}),
      ...(serverContext.subscription?.plan || {}),
    },
  },
  usage: {
    ...(clientContext.usage || {}),
    ...(serverContext.usage || {}),
  },
  advanceCredit: {
    ...(clientContext.advanceCredit || {}),
    ...(serverContext.advanceCredit || {}),
  },
});

export async function chatWithOxy({ message, history = [], context = {}, serverContext = {} }) {
  const trimmed = message?.toString().trim();
  if (!trimmed) {
    return { reply: "اكتب سؤالك وسأساعدك في خدمات Oxygen.", inScope: true };
  }

  const mergedContext = mergeContext(serverContext, context);

  if (!isInScope(trimmed)) {
    return {
      reply: "أنا أوكسي OXY، مساعد Oxygen فقط. كيف أساعدك في اشتراكك أو خدمات الإنترنت؟",
      inScope: false,
    };
  }

  try {
    const geminiReply = await callGemini(trimmed, history, mergedContext);
    if (geminiReply) {
      return { reply: geminiReply, inScope: true, provider: "gemini" };
    }
  } catch (error) {
    console.warn("[OXY] Gemini unavailable, using fallback", error?.message);
  }

  return {
    reply: dataAwareFallbackReply(trimmed, mergedContext),
    inScope: true,
    provider: "fallback",
  };
}

export default { chatWithOxy, isInScope, dataAwareFallbackReply };
