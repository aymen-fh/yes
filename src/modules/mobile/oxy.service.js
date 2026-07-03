/**
 * OXY (أوكسي) — مساعد Oxygen المحدود النطاق.
 * يجيب فقط عن خدمات Oxygen ISP ويرفض الأسئلة الخارجية.
 */

const OXY_SYSTEM_PROMPT = `أنت "أوكسي OXY"، المساعد الذكي الرسمي لتطبيق Oxygen ISP في ليبيا.
قواعد صارمة:
- أجب فقط عن: الاشتراكات، الشحن، الباقات، الاستهلاك، سلفني، الوكلاء، الدعم الفني، التطبيق، الفواتير.
- إذا سُئلت عن موضوع خارج Oxygen (رياضة، سياسة، برمجة عامة، أخبار...) قل بلطف: "أنا أوكسي، مساعد Oxygen فقط. كيف أساعدك في خدمة الإنترنت؟"
- استخدم العربية الفصحى البسيطة، قصيراً وواضحاً.
- لا تخترع أسعاراً أو باقات غير مذكورة في السياق.
- كن ودوداً ومهنياً.`;

const IN_SCOPE_KEYWORDS = [
  "oxygen", "أوكسجين", "أكسجين", "اشتراك", "باقة", "شحن", "رصيد", "انترنت", "إنترنت",
  "سلفني", "سلف", "وكيل", "دعم", "بلاغ", "تذكرة", "استهلاك", "فاتورة", "كرت", "pin",
  "تطبيق", "سرعة", "wifi", "واي فاي", "fiber", "فايبر", "تجديد", "تركيب",
];

const isInScope = (message) => {
  const normalized = message.toString().toLowerCase();
  return IN_SCOPE_KEYWORDS.some((kw) => normalized.includes(kw));
};

const fallbackReply = (message, context = {}) => {
  const q = message.toString().toLowerCase();

  if (!isInScope(message)) {
    return "أنا أوكسي OXY، مساعد Oxygen فقط داخل التطبيق. اسألني عن اشتراكك، الشحن، الباقات، سلفني، أو الدعم الفني.";
  }

  if (q.includes("سلف") || q.includes("سلفني")) {
    return "خدمة سلفني تتيح لك طلب سلفة رصيد مؤقتة على اشتراكك. ادخل إلى الخدمات ← سلفني، اختر المبلغ، وانتظر الموافقة. تُخصم السلفة عند الشحن التالي.";
  }
  if (q.includes("شحن") || q.includes("كرت") || q.includes("pin")) {
    return "لشحن اشتراكك: من الشاشة الرئيسية اختر «شحن الرصيد»، أدخل رمز الكرت أو امسح QR. ستصلك رسالة تأكيد فور نجاح العملية.";
  }
  if (q.includes("باق") || q.includes("ترقية") || q.includes("تجديد")) {
    return "لإدارة باقتك: تبويب «الباقات» يعرض الباقة الحالية والمتاحة. يمكنك الترقية أو التجديد المبكر حسب سياسة الشركة.";
  }
  if (q.includes("استهلاك") || q.includes("كوتا") || q.includes("quota")) {
    return "متابعة الاستهلاك من تبويب «الاستهلاك». إذا كانت باقتك محدودة يظهر المتبقي وتاريخ إعادة الضبط.";
  }
  if (q.includes("وكيل") || q.includes("خريطة") || q.includes("مكتب")) {
    return "للعثور على وكيل قريب: الخدمات ← خريطة الوكلاء. اختر النقطة على الخريطة لعرض التفاصيل والاتصال والاتجاهات.";
  }
  if (q.includes("دعم") || q.includes("بلاغ") || q.includes("تذكرة") || q.includes("مشكل")) {
    return "لفتح بلاغ دعم: الخدمات ← الدعم الفني ← إنشاء بلاغ. صِف المشكلة وسيتابعها فريقنا.";
  }
  if (q.includes("otp") || q.includes("رمز") || q.includes("تحقق") || q.includes("دخول")) {
    return "لتسجيل الدخول: أدخل البريد وكلمة المرور ورقم الهاتف المسجّل في العقد. سيصلك رمز OTP عبر SMS صالح 5 دقائق.";
  }

  const planName = context.planName ? `باقتك الحالية: ${context.planName}. ` : "";
  const status = context.status ? `حالة الاشتراك: ${context.status}. ` : "";
  return `${planName}${status}أنا أوكسي، مساعد Oxygen. اسألني عن الشحن، الباقات، الاستهلاك، سلفني، الوكلاء، أو الدعم الفني.`;
};

const callGemini = async (message, history, context) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const contextBlock = context
    ? `\nسياق المشترك: ${JSON.stringify(context, null, 0)}`
    : "";

  const contents = [
    ...(history || []).slice(-8).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    })),
    {
      role: "user",
      parts: [{ text: `${message}${contextBlock}` }],
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
        temperature: 0.35,
        maxOutputTokens: 512,
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

export async function chatWithOxy({ message, history = [], context = {} }) {
  const trimmed = message?.toString().trim();
  if (!trimmed) {
    return { reply: "اكتب سؤالك وسأساعدك في خدمات Oxygen.", inScope: true };
  }

  if (!isInScope(trimmed)) {
    return {
      reply: "أنا أوكسي OXY، مساعد Oxygen فقط. كيف أساعدك في اشتراكك أو خدمات الإنترنت؟",
      inScope: false,
    };
  }

  try {
    const geminiReply = await callGemini(trimmed, history, context);
    if (geminiReply) {
      return { reply: geminiReply, inScope: true, provider: "gemini" };
    }
  } catch (error) {
    console.warn("[OXY] Gemini unavailable, using fallback", error?.message);
  }

  return { reply: fallbackReply(trimmed, context), inScope: true, provider: "fallback" };
}

export default { chatWithOxy };
