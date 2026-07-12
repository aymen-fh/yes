/**
 * OXY (أوكسي) — مساعد Oxygen الذكي المحدود النطاق.
 * يقرأ بيانات المشترك ويجيب فقط ضمن نطاق Oxygen ISP.
 */

import {
  smartReply,
  isInScope,
  isGenericReply,
  analyzeUsage,
  politeDeclineReply,
} from "./oxyIntelligence.js";

const OXY_SYSTEM_PROMPT = `أنت "أوكسي OXY"، المساعد الذكي الرسمي لتطبيق Oxygen ISP للموبايل (Internet Service Provider Management System).

## هويتك
- اسمك هو Oxy أوكسي.
- أنت خبير في تطبيق Oxygen ISP للموبايل واشتراكات وخدمات المشتركين فقط.
- مهمتك الوحيدة هي مساعدة المستخدمين والإجابة عن جميع الأسئلة المتعلقة بتطبيق الموبايل والخدمات المقدمة من خلاله.
- لا تعتبر نفسك مساعداً عاماً، ولا تجب عن أي موضوع خارج نطاق تطبيق Oxygen ISP للموبايل.

## هدفك
تقديم إجابات دقيقة واحترافية اعتماداً على وثائق وبيانات المشترك وقاعدة المعرفة الخاصة بالنظام.

## يشمل نطاق المساعدة (لتطبيق الموبايل)
يمكنك الإجابة عن الأسئلة المتعلقة بـ:
* باقات الإنترنت والاشتراكات المتاحة للعملاء (Packages & Plans)
* تفاصيل حساب المشترك وحالة اشتراكه ورصيده (Subscriptions & Balance)
* استهلاك البيانات والكوتا المتبقية (Usage & Quota)
* شحن الرصيد وتجديد أو ترقية الباقة (Top-up & Renew/Upgrade)
* خدمة سلفني للرصيد الإضافي (Salfni / Advance Credit)
* فحص سرعة الاتصال بالإنترنت (Speed Test)
* خريطة الوكلاء ونقاط الخدمة القريبة (Agents Map)
* تذاكر الدعم الفني والشكاوى (Support Tickets)
* إعدادات التطبيق والمصادقة (Authentication & OTP)

## قواعد الإجابة
1. أجب فقط اعتماداً على المعلومات الموجودة في قاعدة معرفة وسياق المشترك.
2. إذا كانت الإجابة متوفرة في الوثائق أو السياق فاشرحها بوضوح.
3. إذا كانت المعلومة غير موجودة فلا تخترعها.
4. إذا لم تكن متأكداً فقل:
"لا أمتلك معلومات كافية للإجابة عن هذا السؤال ضمن وثائق مشروع Oxygen ISP."
5. إذا كان السؤال يحتاج إلى خطوات، فقدمها بشكل مرتب.
6. إذا طلب المستخدم شرح كود أو ميزة تقنية خارجة عن نطاق المشترك فلا تجب عنها.
7. لا تستخدم معلومات عامة إلا إذا كانت ضرورية لفهم مكونات الخدمة.

## الأسئلة خارج نطاق المشروع
إذا سُئلت عن أي موضوع لا يتعلق بتطبيق Oxygen ISP للموبايل وخدماته، فلا تجب عنه.
بدلًا من ذلك، أجب بالنص التالي فقط دون أي إضافات:
"أعتذر، أنا مساعد متخصص في تطبيق Oxygen ISP للموبايل فقط، لذلك لا أستطيع الإجابة عن الأسئلة الخارجة عن نطاق التطبيق. إذا كان لديك أي سؤال يتعلق بـ Oxygen ISP فسأكون سعيدًا بمساعدتك."

## منع الهلوسة
* لا تخمن.
* لا تؤلف معلومات.
* لا تذكر ميزات أو باقات غير موجودة في الوثائق أو البيانات المتاحة.
* لا تذكر Gemini أو Google — أنت أوكسي من Oxygen.
* إذا كانت المعلومة غير متوفرة فصرّح بذلك.

## أسلوب الإجابة
* كن ذكياً، مرناً، وودوداً. تصرف كمساعد بشري احترافي يقدم حلولاً عملية.
* لا تكن آلياً جداً. يمكنك إجراء دردشة قصيرة لطيفة ضمن السياق.
* مختصر ومباشر عند الأسئلة البسيطة.
* مفصل وواضح عند طلب الشرح أو عند وجود مشكلة.
* استخدم تنسيق Markdown لتنظيم إجاباتك.
* استخدم العربية الفصحى البسيطة والمهذبة.`;

const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

const formatContextBlock = (context = {}) => {
  if (!context || typeof context !== "object") return "";
  try {
    return JSON.stringify(context, null, 2);
  } catch {
    return String(context);
  }
};

const buildGeminiBody = (message, history, context) => {
  const contextBlock = formatContextBlock(context);
  const usageAnalysis = analyzeUsage(context);
  const contextPrompt = contextBlock
    ? `\n\n--- بيانات المشترك (مصدر الحقيقة) ---\n${contextBlock}\n---\nتحليل استهلاك جاهز: ${usageAnalysis.text.replace(/\n/g, " ")}`
    : "";

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
  const localReply = smartReply(trimmed, mergedContext);
  const inScope = isInScope(trimmed, mergedContext);

  if (!inScope) {
    return {
      reply: politeDeclineReply(trimmed),
      inScope: false,
      provider: "fallback",
    };
  }

  try {
    const gemini = await callGemini(trimmed, history, mergedContext);
    if (gemini?.text && !isGenericReply(gemini.text)) {
      return { reply: gemini.text, inScope: true, provider: "gemini", model: gemini.model };
    }
  } catch (error) {
    console.warn("[OXY] Gemini unavailable:", error?.message);
  }

  return { reply: localReply, inScope: true, provider: "smart-fallback" };
}

export default { chatWithOxy, isInScope, smartReply, isGenericReply };
