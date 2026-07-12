/**
 * OXY (أوكسي) — مساعد Oxygen الذكي المحدود النطاق.
 * يقرأ بيانات المشترك ويجيب فقط ضمن نطاق Oxygen ISP.
 */

import {
  smartReply,
  isClearlyOutOfScope,
  isGenericReply,
  analyzeUsage,
  politeDeclineReply,
} from "./oxyIntelligence.js";

const OXY_SYSTEM_PROMPT = `أنت "أوكسي OXY"، المساعد الذكي الرسمي لتطبيق Oxygen ISP للموبايل.

## هويتك
- اسمك أوكسي OXY، مساعد ذكي متخصص في خدمات Oxygen ISP للمشتركين.
- أنت لا تُعرّف نفسك بأنك "روبوت" أو "شات بوت" — أنت مساعد ذكي متقدم.
- لا تذكر Gemini أو Google في أي إجابة — أنت أوكسي من Oxygen.

## منهجية التحليل العميق (مهم جداً)
قبل الإجابة على أي سؤال، قم بتحليل النية الحقيقية للمستخدم:
1. **ما الذي يريده فعلاً؟** — حتى لو صاغ السؤال بطريقة غير مباشرة أو عامية.
2. **هل يوجد في السياق (بيانات المشترك) ما يساعد على الإجابة؟** — استخدمها دائماً.
3. **هل السؤال مرتبط بخدمات الإنترنت والاشتراكات والتطبيق؟** — إذا كانت الإجابة نعم ولو بشكل غير مباشر، أجب.
4. **إذا كان السؤال غامضاً** — افترض أفضل تفسير ممكن لخدمة المشترك واجب على أساسه.

## يشمل نطاق المساعدة
- باقات الإنترنت والاشتراكات والمقارنة بينها والتوصية بالأنسب
- تفاصيل حساب المشترك: الرصيد، الاشتراك، الحالة
- استهلاك البيانات والكوتا المتبقية وتحليلها
- شحن الرصيد، التجديد، الترقية
- خدمة سلفني (Advance Credit)
- سرعة الاتصال والمشاكل التقنية للإنترنت
- خريطة الوكلاء ونقاط الخدمة
- تذاكر الدعم الفني والشكاوى
- إعدادات التطبيق، تسجيل الدخول، OTP
- أي سؤال يتعلق بتجربة المشترك مع خدمة الإنترنت

## كيفية استخدام بيانات المشترك
- **بيانات المشترك** في السياق هي مصدر الحقيقة — استخدمها دائماً في إجاباتك.
- **الباقات المتاحة في النظام** هي القائمة الوحيدة المعتمدة للباقات — لا تخترع باقات.
- عند سؤال عن الباقات: اعرض القائمة كاملة، قارن، وقدّم توصية مدروسة مبنية على السعر والسرعة والكوتا.
- نبّه المشترك لباقته الحالية عند المقارنة.

## قواعد الإجابة
1. حلّل النية أولاً، ثم أجب بدقة واحترافية.
2. استخدم البيانات المتاحة في السياق كاملاً.
3. لا تؤلف معلومات — إذا لم تجد البيانات صرّح بذلك بلطف واقترح بديلاً.
4. قدّم الخطوات بشكل مرتب عند الحاجة.
5. تعامل مع الأسئلة العامية والمختصرة بنفس الجدية — حلل النية ولا تطلب إعادة صياغة.

## الأسئلة الخارجة عن النطاق تماماً
فقط إذا كان السؤال لا يمت بصلة واضحة لخدمة الإنترنت أو التطبيق (كالأخبار، الرياضة، الطقس، الطبخ)، أجب بـ:
"أعتذر، أنا مساعد متخصص في تطبيق Oxygen ISP للموبايل فقط، لذلك لا أستطيع الإجابة عن الأسئلة الخارجة عن نطاق التطبيق. إذا كان لديك أي سؤال يتعلق بـ Oxygen ISP فسأكون سعيدًا بمساعدتك."

## أسلوب الإجابة
- ذكي، مرن، وودود — تصرف كخبير حقيقي يقدم حلولاً عملية.
- مختصر للأسئلة البسيطة، مفصّل للمشاكل والشرح.
- استخدم Markdown لتنظيم الإجابات (عناوين، قوائم، جداول).
- استخدم العربية الفصحى البسيطة مع قبول العامية في الأسئلة.`;


const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

const formatPlansBlock = (plans = []) => {
  if (!Array.isArray(plans) || plans.length === 0) return "";
  const lines = plans.map((p, i) => {
    const quota = p.isUnlimited ? "غير محدود" : `${p.dataLimitGb} GB`;
    const price = p.monthlyPrice ? `${p.monthlyPrice} د.ل/شهر` : "";
    const speed = p.speedMbps ? `${p.speedMbps} Mbps` : "";
    const desc = p.description ? ` — ${p.description}` : "";
    return `  ${i + 1}. ${p.name} | الكوتا: ${quota} | السرعة: ${speed} | السعر: ${price}${desc}`;
  });
  return `\n\n--- الباقات المتاحة في النظام (من قاعدة البيانات) ---\n${lines.join("\n")}\n---`;
};

const buildGeminiBody = (message, history, context) => {
  const { availablePlans, ...subscriberData } = context || {};
  const usageAnalysis = analyzeUsage(context);

  // Section 1: subscriber personal data (without plans list to keep it clean)
  const subscriberBlock = JSON.stringify(subscriberData, null, 2);

  // Section 2: available plans from DB — formatted as readable table
  const plansBlock = formatPlansBlock(availablePlans);

  // Section 3: pre-computed usage analysis
  const usageSummary = usageAnalysis.text.replace(/\n/g, " ");

  const contextPrompt = `\n\n--- بيانات المشترك (مصدر الحقيقة — لا تتجاوزها) ---\n${subscriberBlock}\n---\nتحليل استهلاك جاهز: ${usageSummary}${plansBlock}`;

  return {
    systemInstruction: { parts: [{ text: OXY_SYSTEM_PROMPT }] },
    contents: [
      ...(history || []).slice(-12).map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
      {
        role: "user",
        parts: [{ text: `${message}${contextPrompt}` }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };
};

const callGeminiModel = async (model, body, apiKey) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    return { ok: false, status: response.status, details: details.slice(0, 200) };
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return { ok: Boolean(text), text };
};

const callGemini = async (message, history, context) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[OXY] GEMINI_API_KEY missing — using smart fallback");
    return null;
  }

  if (!apiKey.startsWith("AIza") && !apiKey.startsWith("AQ.")) {
    console.warn(
      "[OXY] GEMINI_API_KEY format invalid (expected AIza... or AQ... from https://aistudio.google.com/apikey) — using smart fallback",
    );
    return null;
  }

  const body = buildGeminiBody(message, history, context);

  for (const model of GEMINI_MODELS) {
    try {
      const result = await callGeminiModel(model, body, apiKey);
      if (result.ok) {
        return { text: result.text, model };
      }
      console.warn(`[OXY] Gemini ${model} HTTP ${result.status}: ${result.details || ""}`);
    } catch (error) {
      console.warn(`[OXY] Gemini ${model} error:`, error?.message);
    }
  }

  return null;
};

const mergeContext = (serverContext = {}, clientContext = {}) => ({
  ...clientContext,
  ...serverContext,
  customer: {
    ...(clientContext.customer || {}),
    ...(serverContext.customer || {}),
    name:
      serverContext.customer?.name ||
      clientContext.customer?.name ||
      clientContext.customerName ||
      "",
  },
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
    return { reply: "اكتب سؤالك وسأساعدك في خدمات Oxygen.", inScope: true, provider: "fallback" };
  }

  const mergedContext = mergeContext(serverContext, context);

  // Only block topics that are CLEARLY unrelated (sports, politics, etc.)
  // Everything else goes to Gemini for deep analysis first.
  if (isClearlyOutOfScope(trimmed)) {
    return {
      reply: politeDeclineReply(trimmed),
      inScope: false,
      provider: "fallback",
    };
  }

  // Always try Gemini first — it does the deep analysis and context-aware answering.
  try {
    const gemini = await callGemini(trimmed, history, mergedContext);
    if (gemini?.text && !isGenericReply(gemini.text)) {
      return { reply: gemini.text, inScope: true, provider: "gemini", model: gemini.model };
    }
  } catch (error) {
    console.warn("[OXY] Gemini unavailable:", error?.message);
  }
  // Gemini unavailable or returned generic reply — use smartReply as safety fallback
  const localReply = smartReply(trimmed, mergedContext);
  return { reply: localReply, inScope: true, provider: "smart-fallback" };
}

export default { chatWithOxy, isClearlyOutOfScope, smartReply, isGenericReply };
