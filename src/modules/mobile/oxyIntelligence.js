/**
 * OXY intelligence engine — natural language + data analysis (server).
 */

import { answerFaq, matchFaq } from "./oxyKnowledge.js";

export const SUPPORT = {
  phone: "19000",
  phoneDisplay: "+218 91 000 0000",
  email: "support@oxygen.app",
};

const CLEARLY_OUT_OF_SCOPE = [
  "messi", "ronaldo", "mbappe", "football", "soccer", "كرة القدم", "كرة",
  "رياضة", "sport", "nba", "lakers",
  "سياسة", "politics", "election", "انتخاب",
  "python", "javascript", "react", "flutter", "برمجة", "coding", "code",
  "طقس", "weather", "forecast", "درجة الحرارة",
  "أخبار", "news", "bbc", "cnn",
  "فيلم", "movie", "netflix", "مسلسل", "series",
  "gpt", "chatgpt", "gemini", "openai", "claude",
  "bitcoin", "crypto", "bitcoin",
  "recipe", "طبخ", "وصفة",
  "trump", "biden", "putin", "تاريخ", "history", "جغرافيا", "geography",
  "math", "رياضيات", "علم", "science", "دين", "religion", "طب", "medicine",
  "نكت", "joke", "funny", "احكي", "قصة", "story", "أغنية", "song", "music",
  "واجب", "homework", "essay", "مقال", "translate", "ترجم", "حل سؤال",
  "tiktok", "instagram", "facebook", "whatsapp business",
  "iphone", "samsung", "apple", "google", "microsoft",
  "القمر", "الشمس", "الفضاء", "space", "planet",
];

const EXTERNAL_TOPIC_RE = [
  /messi|ronaldo|football|sport|كرة|nba|lakers/i,
  /politic|election|سياس|trump|biden|putin|انتخاب/i,
  /weather|forecast|طقس|درجة\s*الحرارة/i,
  /movie|film|netflix|فيلم|مسلسل|series/i,
  /python|javascript|react|flutter|برمج|coding|program/i,
  /news|bbc|cnn|أخبار/i,
  /bitcoin|crypto/i,
  /recipe|طبخ|وصفة/i,
  /gpt|chatgpt|gemini|openai|claude/i,
  /joke|نكت|funny|story|قصة|أغنية|music/i,
  /history|geography|math|science|medicine|religion|تاريخ|رياضيات|طب/i,
  /homework|واجب|essay|مقال|translate|ترجم/i,
  /tiktok|instagram|facebook/i,
];

const IN_SCOPE_HINTS = [
  "oxygen", "oxy", "أوكسي", "أكسجين", "أوكسجين",
  "اشتراك", "subscription", "باقة", "باقات", "plan", "plans", "package",
  "شحن", "topup", "recharge", "رصيد", "balance", "رصيدي", "فلوس", "حساب",
  "سلفني", "سلف", "advance", "credit",
  "وكيل", "وكلاء", "agent", "agents", "map", "خريطة", "مكتب", "office",
  "دعم", "support", "help", "بلاغ", "تذكرة", "ticket", "complaint", "مشكل",
  "استهلاك", "usage", "quota", "كوتا", "data", "جيجا", "gb", "متبقي", "consumption",
  "فاتورة", "invoice", "bill", "كرت", "card", "pin", "qr",
  "انترنت", "إنترنت", "internet", "wifi", "سرعة", "speed", "بطي", "slow",
  "تجديد", "renew", "ترقية", "upgrade", "تطبيق", "app",
  "otp", "رمز", "تحقق", "login", "دخول", "password", "كلمة",
  "مرحب", "hello", "hi", "hey", "اهلا", "أهلا", "السلام", "salam",
  "راي", "رأي", "رأيك", "رايك", "think", "opinion", "نصيحة", "tip", "advice",
  "شكر", "thanks", "thank", "تسلم", "ممتاز", "ok", "okay",
  "how are", "how r u", "how're", "كيف حال", "كيفك", "شلونك", "شنو",
  "معامل", "transaction", "عمليات", "سجل", "ملخص", "summary", "كل", "all",
  "اشتراكي", "باقتي", "استهلاكي", "حسابي",
  "ضعف", "ضعيف", "بطي", "بطء", "انقطاع", "راوتر", "router", "مودم", "modem",
  "تغطية", "coverage", "غالي", "expensive", "فرق", "difference",
  "قليل", "few", "مشكلة", "problem", "issue", "فشل", "fail", "offline",
  "سلفني", "salfni", "فاتورة", "invoice", "إلغاء", "cancel", "تفعيل", "activate",
  "نسيت", "forgot", "كلمة", "password", "مساعد", "assistant", "chatbot",
  "كيف", "how", "أين", "where", "وين", "فين", "متى", "when",
  "اختبار", "test", "انته", "نفذ", "خلص", "موقوف", "suspended",
  "ألعاب", "gaming", "بث", "stream", "wifi", "واي", "إعدادات", "settings",
  "شركة", "company", "about", "من أنت", "who are you",
];

const SMALL_TALK = [
  /how\s*(are|r)\s*(you|u|ya)\??/i,
  /how\s*is\s*it\s*going/i,
  /what'?s\s*up/i,
  /كيف\s*حال/i,
  /كيفك/i,
  /شلونك/i,
  /عامل\s*ا?يه/i,
  /ازيك/i,
];

const THANKS = [/thank/i, /thanks/i, /شكر/i, /تسلم/i, /ممتاز/i, /great/i, /perfect/i];

const OPINION = [/را[يأ]ك/i, /رأيك/i, /what do you think/i, /opinion/i, /نصيحة/i, /tip/i, /advice/i];

const GREETING = [/^(hi|hello|hey|salam|marhaba)\b/i, /مرحب/i, /السلام/i, /اهلا/i, /أهلا/i];

export const isClearlyOutOfScope = (message) => {
  const q = message.toString().toLowerCase().trim();
  if (!q) return false;
  if (CLEARLY_OUT_OF_SCOPE.some((kw) => q.includes(kw))) return true;
  return EXTERNAL_TOPIC_RE.some((re) => re.test(q));
};

/** ردود مهذبة عند الأسئلة الخارجية عن Oxygen */
export const politeDeclineReply = (message) => {
  const q = message.toString().trim();
  const lower = q.toLowerCase();

  if (EXTERNAL_TOPIC_RE.some((re) => re.test(q))) {
    return "عذراً 🙏 لا أستطيع الإجابة عن هذا الموضوع — أنا أوكسي، مساعد Oxygen للإنترنت والاشتراك فقط.\n"
      + "هل أساعدك في: رصيدك، باقتك، ضعف النت، أو الدعم الفني؟";
  }

  if (
    /^(who|what|where|when|why|how)\s+(is|are|was|were|did|do|can)/i.test(lower) ||
    /^(من|ما|ماهو|ماهي|ماذا|أين|متى|لماذا)\s+(هو|هي|هم|هذا)/u.test(q)
  ) {
    return "عذراً، لا أملك معلومات عن هذا السؤال. أنا متخصص في Oxygen: اشتراكك، الشحن، الباقات، والدعم.\n"
      + "ما الذي تريد معرفته عن خدمتك؟";
  }

  if (/joke|نكت|احك|قصة|story|تحك/i.test(lower)) {
    return "😊 أنا مساعد خدمة Oxygen وليس للأسئلة العامة، لكن يسعدني مساعدتك في الإنترنت أو اشتراكك!";
  }

  if (/homework|واجب|essay|مقال|translate|ترجم|حل\s*لي/i.test(lower)) {
    return "عذراً 🙏 لا أستطيع المساعدة في الواجبات أو الترجمة — أنا متخصص في Oxygen فقط.\n"
      + "هل أساعدك في رصيدك، باقتك، أو الدعم الفني؟";
  }

  return "عذراً، لا أستطيع الإجابة — هذا السؤال خارج نطاق Oxygen.\n"
    + "اسألني عن: رصيدك، استهلاكك، الباقات، ضعف الإنترنت، سلفني، أو الدعم.";
};

export const isInScope = (message, context = {}) => {
  const q = message.toString().toLowerCase().trim();
  if (!q) return true;
  if (isClearlyOutOfScope(q)) return false;
  if (GREETING.some((re) => re.test(q))) return true;
  if (SMALL_TALK.some((re) => re.test(q))) return true;
  if (THANKS.some((re) => re.test(q))) return true;
  if (matchFaq(message)) return true;
  if (IN_SCOPE_HINTS.some((kw) => q.includes(kw))) return true;
  return false;
};

export const pick = (ctx, ...paths) => {
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

export const analyzeUsage = (context = {}) => {
  const consumed = Number(pick(context, "usage.consumedGb", "consumedGb") ?? NaN);
  const remaining = Number(pick(context, "usage.remainingGb", "remainingGb") ?? NaN);
  const quota = Number(pick(context, "usage.quotaTotalGb", "subscription.plan.quotaGb") ?? NaN);
  const isUnlimited = pick(context, "usage.isUnlimited", "isUnlimited", "subscription.plan.isUnlimited") === true;
  const planName = pick(context, "subscription.plan.name", "planName");
  const periodEnd = pick(context, "usage.periodEnd", "subscription.nextBillingDate", "nextBillingDate");

  if (isUnlimited) {
    return {
      level: "unlimited",
      text: `باقتك${planName ? ` (${planName})` : ""} غير محدودة الاستهلاك — استخدم بحرية. لمتابعة التفاصيل: تبويب «الاستهلاك».`,
    };
  }

  if (!Number.isFinite(consumed) || !Number.isFinite(remaining)) {
    return {
      level: "unknown",
      text: "لم أتمكن من قراءة استهلاكك الآن. افتح تبويب «الاستهلاك» أو حدّث الصفحة ثم اسألني مجدداً.",
    };
  }

  const total = Number.isFinite(quota) && quota > 0 ? quota : consumed + remaining;
  const usedPct = total > 0 ? Math.round((consumed / total) * 100) : 0;
  const remainPct = total > 0 ? Math.round((remaining / total) * 100) : 0;

  let assessment;
  let level;
  if (remainPct <= 10) {
    level = "critical";
    assessment = "⚠️ استهلاكك مرتفع جداً — متبقي أقل من 10%. أنصح بتقليل الاستخدام أو ترقية الباقة قبل نفاد الكوتا.";
  } else if (remainPct <= 30) {
    level = "high";
    assessment = "استهلاكك مرتفع نسبياً — راقب الاستخدام أو فكّر بترقية الباقة إن احتجت.";
  } else if (remainPct <= 60) {
    level = "moderate";
    assessment = "استهلاكك معتدل — ما زال عندك هامش جيد لبقية الدورة.";
  } else {
    level = "low";
    assessment = "استهلاكك ممتاز — ما زال لديك هامش واسع.";
  }

  const periodPart = periodEnd ? ` تنتهي الدورة ${periodEnd}.` : "";
  const planPart = planName ? ` (باقة ${planName})` : "";

  return {
    level,
    usedPct,
    remainPct,
    consumed,
    remaining,
    total,
    text: `${assessment}\n\n📊 الأرقام: استهلكت ${consumed} GB من ~${total} GB (${usedPct}%)، متبقي ${remaining} GB (${remainPct}%)${planPart}.${periodPart}`,
  };
};

export const isOpinionAboutUsage = (message) => {
  const q = message.toString().toLowerCase();
  const aboutUsage = /استهلاك|usage|quota|كوتا|جيجا|gb|data|بيانات|انترنت|إنترنت|internet/.test(q);
  const wantsOpinion = OPINION.some((re) => re.test(q)) || /ما\s*(را[يأ]ك|رأيك)/.test(q);
  return aboutUsage && (wantsOpinion || q.includes("كيف") || q.includes("هل"));
};

export const isSmallTalk = (message) => SMALL_TALK.some((re) => re.test(message.toString()));

export const isThanks = (message) => THANKS.some((re) => re.test(message.toString()));

export const isGreeting = (message) => GREETING.some((re) => re.test(message.toString().trim()));

export const isGenericReply = (reply) => {
  const r = (reply || "").toString();
  return (
    r.includes("مساعد Oxygen فقط") ||
    r.includes("خارج نطاق Oxygen") ||
    r.includes("لا أستطيع الإجابة") ||
    r.includes("لا أملك معلومات") ||
    r.includes("اسألني عن رصيدك، استهلاكك") ||
    r.includes("اسألني عن اشتراكك") ||
    r.length < 20
  );
};

export const smartReply = (message, context = {}) => {
  const q = message.toString().toLowerCase().trim();

  if (!isInScope(message, context)) {
    return politeDeclineReply(message);
  }

  const name = pick(context, "customer.name", "customerName");

  if (isGreeting(message)) {
    const greeting = name ? `مرحباً ${name}! ` : "مرحباً! ";
    return `${greeting}أنا أوكسي، مساعد Oxygen. اسألني عن رصيدك، استهلاكك، باقتك، الشحن، سلفني، أو الدعم الفني.`;
  }

  if (isSmallTalk(message)) {
    return "بخير والحمد لله! 😊 أنا هنا لمساعدتك في Oxygen. تبي تعرف رصيدك، استهلاكك، أو باقتك؟";
  }

  if (isThanks(message)) {
    return "العفو! سعيد بمساعدتك. إذا احتجت أي شيء عن اشتراكك أو خدمات Oxygen أنا هنا.";
  }

  if (isOpinionAboutUsage(message) || (OPINION.some((re) => re.test(q)) && /استهلاك|usage|quota|جيجا|gb|data/.test(q))) {
    return analyzeUsage(context).text;
  }

  const faqAnswer = answerFaq(message, context);
  if (faqAnswer) return faqAnswer;

  const planName = pick(context, "subscription.plan.name", "planName");
  const statusLabel = pick(context, "subscription.statusLabel", "status");
  const balance = pick(context, "accountBalance");
  const consumed = pick(context, "usage.consumedGb", "consumedGb");
  const remaining = pick(context, "usage.remainingGb", "remainingGb");
  const isUnlimited = pick(context, "usage.isUnlimited", "isUnlimited") === true;
  const nextBilling = pick(context, "subscription.nextBillingDate", "nextBillingDate");
  const subNumber = pick(context, "subscription.number", "subscriptionNumber");
  const speed = pick(context, "subscription.plan.speedMbps", "speedMbps");
  const planPrice = pick(context, "subscription.plan.price", "planPrice");
  const advance = context.advanceCredit || {};
  const openTickets = pick(context, "openTicketsCount");
  const supportPhone = pick(context, "support.phone") || SUPPORT.phone;

  if (/ملخص|summary|كل\s*شي|everything|حسابي|account/.test(q)) {
    const parts = [];
    if (name) parts.push(`👤 ${name}`);
    if (planName) parts.push(`📦 الباقة: ${planName}`);
    if (statusLabel) parts.push(`📡 الحالة: ${statusLabel}`);
    if (balance != null) parts.push(`💰 الرصيد: ${balance} د.ل`);
    if (!isUnlimited && remaining != null && consumed != null) {
      parts.push(`📊 الاستهلاك: ${consumed} GB مستخدم / ${remaining} GB متبقي`);
    } else if (isUnlimited) parts.push("📊 استهلاك غير محدود");
    if (nextBilling) parts.push(`📅 التجديد: ${nextBilling}`);
    if (parts.length) return `ملخص حسابك:\n${parts.join("\n")}`;
  }

  if (/رصيد|balance/.test(q) || (q.includes("كم") && /فلوس|رصيد|حساب|money/.test(q))) {
    if (balance != null) return `💰 رصيد حسابك: ${balance} د.ل. للشحن: الرئيسية ← شحن الرصيد.`;
    return "لمعرفة رصيدك: الرئيسية ← شحن الرصيد.";
  }

  if (/استهلاك|usage|quota|كوتا|جيجا|\bgb\b|data|بيانات/.test(q) || (q.includes("متبقي") && /انترنت|إنترنت|data/.test(q))) {
    if (/را[يأ]ك|رأيك|think|opinion|نصيحة|كيف|هل/.test(q)) return analyzeUsage(context).text;
    if (isUnlimited) return `باقتك${planName ? ` (${planName})` : ""} غير محدودة. التفاصيل في «الاستهلاك».`;
    if (consumed != null && remaining != null) {
      return `📊 استهلكت ${consumed} GB، متبقي ${remaining} GB${planName ? ` (باقة ${planName})` : ""}. للتحليل التفصيلي اسأل: «ما رأيك في استهلاكي؟»`;
    }
    return "متابعة الاستهلاك من تبويب «الاستهلاك».";
  }

  if (/باق|plan|package|سرعة|speed/.test(q)) {
    const parts = [];
    if (planName) parts.push(`📦 ${planName}`);
    if (speed) parts.push(`⚡ ${speed} Mbps`);
    if (planPrice) parts.push(`💵 ${planPrice} د.ل/شهر`);
    if (isUnlimited) parts.push("♾️ غير محدود");
    else if (remaining != null) parts.push(`📊 متبقي ${remaining} GB`);
    if (parts.length) return `باقتك: ${parts.join(" · ")}. للإدارة: تبويب «الباقات».`;
    return "لإدارة باقتك: تبويب «الباقات».";
  }

  if (/تجديد|renew|فاتورة|billing/.test(q) || (q.includes("متى") && /ينته|تنته|فاتورة/.test(q))) {
    if (nextBilling) return `📅 موعد التجديد: ${nextBilling}${planName ? ` (باقة ${planName})` : ""}.`;
    return "موعد التجديد في تبويب «الباقات» أو «الاستهلاك».";
  }

  if (/حالة|وضع|status/.test(q)) {
    const parts = [];
    if (statusLabel) parts.push(`الحالة: ${statusLabel}`);
    if (subNumber) parts.push(`رقم الاشتراك: ${subNumber}`);
    if (parts.length) return parts.join(". ") + ".";
  }

  if (/سلف|advance|credit/.test(q)) {
    if (advance.status === "active" && advance.owedAmount > 0) {
      return `💳 سلفة نشطة: ${advance.owedAmount} د.ل — تُخصم عند الشحن التالي.`;
    }
    if (advance.status === "pending") return "⏳ طلب سلفني قيد المراجعة.";
    if (advance.canRequest && advance.maxRequest) {
      return `✅ يمكنك طلب سلفة حتى ${advance.maxRequest} د.ل من الخدمات ← سلفني.`;
    }
    return "سلفني: الخدمات ← سلفني.";
  }

  if (/شحن|كرت|pin|topup|recharge|qr/.test(q)) {
    return "🔋 للشحن: الرئيسية ← شحن الرصيد ← أدخل PIN أو امسح QR.";
  }

  if (/ترقية|upgrade/.test(q)) return "⬆️ للترقية: تبويب «الباقات» ← اختر باقة أعلى.";

  if (/وكيل|agent|خريطة|map|مكتب/.test(q)) {
    return "📍 الوكلاء: الخدمات ← خريطة الوكلاء.";
  }

  if (/دعم|support|help|بلاغ|تذكرة|ticket|complaint|مشكل/.test(q)) {
    const ticketPart = openTickets > 0 ? ` (لديك ${openTickets} بلاغ مفتوح)` : "";
    return `🛠️ الدعم: الخدمات ← الدعم الفني ← إنشاء بلاغ${ticketPart}. أو اتصل ${supportPhone}.`;
  }

  if (/otp|رمز|تحقق|دخول|login|password|كلمة/.test(q)) {
    return "🔐 الدخول: المعرف + كلمة المرور من العقد. OTP يصل عبر SMS. «هل نسيت كلمة المرور؟» للاست recovery.";
  }

  if (/معامل|transaction|عمليات|سجل/.test(q)) {
    const txs = context.latestTransactions;
    if (Array.isArray(txs) && txs.length > 0) {
      const summary = txs.slice(0, 3).map((t) => `${t.amount} د.ل (${t.status})`).join("؛ ");
      return `📋 آخر العمليات: ${summary}.`;
    }
    return "سجل المعاملات في الشاشة الرئيسية.";
  }

  const planPart = planName ? `باقتك ${planName}. ` : "";
  const hint =
    "اسألني: «ضعف الإنترنت»، «لماذا الباقات قليلة؟»، «ما رأيك في استهلاكي؟»، «كم رصيدي؟»";
  return `${planPart}${hint}`;
};

export const isFaqQuestion = (message) => Boolean(matchFaq(message));

export default {
  smartReply,
  isInScope,
  isClearlyOutOfScope,
  analyzeUsage,
  isGenericReply,
  isSmallTalk,
  isThanks,
  isGreeting,
  isOpinionAboutUsage,
  politeDeclineReply,
};
