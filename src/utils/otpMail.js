import nodemailer from "nodemailer";

const maskEmail = (email) => {
  const normalized = String(email || "").trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0) return "***";

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible =
    local.length <= 1 ? "*" : `${local[0]}${"*".repeat(Math.min(local.length - 1, 3))}`;
  return `${visible}@${domain}`;
};

const buildMessages = (code, purpose) => {
  const loginText = `رمز تسجيل الدخول في تطبيق Oxygen هو: ${code}\n\nصالح لمدة 5 دقائق.\nلا تشارك هذا الرمز مع أحد.`;
  const recoveryText = `رمز استعادة كلمة المرور في Oxygen هو: ${code}\n\nصالح لمدة 5 دقائق.\nلا تشارك هذا الرمز مع أحد.`;

  if (purpose === "password_recovery") {
    return {
      subject: "رمز استعادة كلمة المرور — Oxygen",
      text: recoveryText,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>استعادة كلمة المرور</h2>
        <p>رمز التحقق الخاص بك:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#E51D86">${code}</p>
        <p>صالح لمدة <strong>5 دقائق</strong>.</p>
        <p>لا تشارك هذا الرمز مع أحد.</p>
      </div>`,
    };
  }

  return {
    subject: "رمز تسجيل الدخول — Oxygen",
    text: loginText,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>تسجيل الدخول إلى Oxygen</h2>
      <p>رمز التحقق الخاص بك:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#E51D86">${code}</p>
      <p>صالح لمدة <strong>5 دقائق</strong>.</p>
      <p>لا تشارك هذا الرمز مع أحد.</p>
    </div>`,
  };
};

const createTransport = () => {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
};

export const sendOtpEmail = async ({ email, code, purpose = "login" }) => {
  const to = String(email || "").trim().toLowerCase();
  if (!to) return;

  const { subject, text, html } = buildMessages(code, purpose);
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || "noreply@oxygen.app";
  const transport = createTransport();

  if (!transport) {
    console.info(`[OTP Email] Sent ${purpose} code ${code} to ${to}`);
    return;
  }

  try {
    await transport.sendMail({ from, to, subject, text, html });
  } catch (error) {
    console.error("[OTP Email] Failed to send message", error);
    throw error;
  }
};

export { maskEmail };
