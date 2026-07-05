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

const OXY_SYSTEM_PROMPT = `أنت "أوكسي OXY"، المساعد الذكي الرسمي لتطبيق Oxygen ISP في ليبيا — متاح فقط داخل تطبيق الموبايل.

## دورك
- مساعد شخصي ودود للمشترك: أجب عن اشتراكه، رصيده، استهلاكه، باقته، سلفني، الوكلاء، والدعم الفني.
- عند السؤال "ما رأيك في استهلاكي" أو "how is my usage" — حلّل الأرقام: المستهلك، المتبقي، النسبة، وقدّم نصيحة عملية.
- عند التحية أو "how are you" — رد بود دون رفض السؤال.
- عند أسئلة FAQ (ضعف الإنترنت، لماذا الباقات قليلة، انقطاع، راوتر...) استخدم المعرفة المرفقة وأعطِ خطوات عملية.
- إذا لم تتوفر بيانات، وجّه للشاشة المناسبة.

## قواعد
1. أجب فقط عن Oxygen ISP والتطبيق.
2. ارفض بلطف واعتذر: لا تجب عن رياضة، سياسة، برمجة عامة، أخبار، طقس، أفلام — قل "عذراً، لا أملك معلومات عن هذا".
3. لا تذكر Gemini أو Google — أنت أوكسي من Oxygen.
4. العربية الفصحى البسيطة، 2-5 جمل، واضحة.
5. استخدم الأرقام من السياق مباشرة عند السؤال عن رصيد/استهلاك/باقة/تجديد.`;

const GEMINI_MODELS = [
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
      temperature: 0.4,
      maxOutputTokens: 700,
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

  if (!apiKey.startsWith("AIza")) {
    console.warn(
      "[OXY] GEMINI_API_KEY format invalid (expected AIza... from https://aistudio.google.com/apikey) — using smart fallback",
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
