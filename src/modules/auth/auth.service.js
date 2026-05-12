import { randomInt, randomUUID } from "node:crypto";

import EncryptionServices from "../../utils/encryptionServices.js";
import JwtService from "../../utils/jwtServices.js";
import { ConflictError, UnauthorizedError } from "../../utils/errors.js";
import { Roles } from "../../utils/roles.js";
import CustomerModel from "../customers/customer.model.js";
import { createReadableCode, serializeDoc } from "../common/serializers.js";

const LOGIN_OTP_EXPIRY_MS = 5 * 60 * 1000;
const LOGIN_OTP_MAX_ATTEMPTS = 5;
const loginOtpSessions = new Map();

const normalizePhone = (value) => value.toString().replace(/\D/g, "");

const stripLeadingInternationalPrefix = (value) =>
  value.startsWith("00") ? value.slice(2) : value;

const phonesMatch = (contractPhone, providedPhone) => {
  const normalizedContract = stripLeadingInternationalPrefix(normalizePhone(contractPhone));
  const normalizedProvided = stripLeadingInternationalPrefix(normalizePhone(providedPhone));

  if (!normalizedContract || !normalizedProvided) {
    return false;
  }

  if (normalizedContract === normalizedProvided) {
    return true;
  }

  const contractTail =
    normalizedContract.length > 9
      ? normalizedContract.slice(-9)
      : normalizedContract;
  const providedTail =
    normalizedProvided.length > 9
      ? normalizedProvided.slice(-9)
      : normalizedProvided;

  return contractTail === providedTail;
};

const generateOtpCode = () => String(randomInt(0, 1000000)).padStart(6, "0");

const maskPhone = (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return "";

  if (normalized.length <= 3) {
    return `***${normalized}`;
  }

  return `***${normalized.slice(-3)}`;
};

const pruneExpiredOtpSessions = () => {
  const now = Date.now();

  for (const [otpToken, session] of loginOtpSessions.entries()) {
    if (session.expiresAt <= now) {
      loginOtpSessions.delete(otpToken);
    }
  }
};

const sendLoginOtpSms = async ({ phone, code }) => {
  const message = `رمز التحقق الخاص بتسجيل الدخول هو: ${code}`;
  const providerUrl = process.env.SMS_PROVIDER_URL;

  if (!providerUrl) {
    console.info(`[OTP SMS] Sent login code ${code} to ${phone}`);
    return;
  }

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (process.env.SMS_PROVIDER_TOKEN) {
    headers.Authorization = `Bearer ${process.env.SMS_PROVIDER_TOKEN}`;
  }

  try {
    const response = await fetch(providerUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: phone,
        message,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error(
        `[OTP SMS] Provider responded with ${response.status}: ${details}`
      );
    }
  } catch (error) {
    console.error("[OTP SMS] Failed to call SMS provider", error);
  }
};

const toAuthPayload = (customer) => ({
  id: customer._id.toString(),
  role: customer.role,
  isAdmin: customer.role === Roles.ADMIN,
  isAgent: [Roles.SUPPORT, Roles.DISTRIBUTOR].includes(customer.role),
});

const sanitizeCustomer = (customer) =>
  serializeDoc(customer, {
    exclude: ["password", "refreshTokenHash"],
  });

const createUniqueCustomerCode = async () => {
  // Retry random code generation to avoid unique index collisions.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = createReadableCode("CUS");
    const exists = await CustomerModel.exists({ customerCode: candidate });
    if (!exists) return candidate;
  }

  return `${createReadableCode("CUS")}-${Date.now().toString().slice(-4)}`;
};

const issueTokenPair = async (customer) => {
  const token = JwtService.sign(toAuthPayload(customer));
  const refreshToken = JwtService.signRefresh({ id: customer._id.toString(), role: customer.role });
  // Store only a hash of the refresh token to reduce token leakage impact.
  const refreshTokenHash = await EncryptionServices.encryptText(refreshToken);

  await CustomerModel.findByIdAndUpdate(customer._id, {
    refreshTokenHash,
    lastLoginAt: new Date(),
  });

  return { token, refreshToken };
};

const findCustomerByIdentifier = async (identifier) => {
  if (identifier.includes("@")) {
    return CustomerModel.findOne({ email: identifier.toLowerCase().trim() });
  }

  return CustomerModel.findOne({ customerCode: identifier.toUpperCase().trim() });
};

class AuthService {
  static async register(payload) {
    const existing = await CustomerModel.findOne({ email: payload.email.toLowerCase() });
    if (existing) {
      throw new ConflictError("Email already in use");
    }

    const customerCode = await createUniqueCustomerCode();
    const password = await EncryptionServices.encryptText(payload.password);

    const customer = await CustomerModel.create({
      customerCode,
      fullName: payload.fullName,
      email: payload.email.toLowerCase().trim(),
      password,
      phone: payload.phone,
      address: payload.address || "",
      role: Roles.CUSTOMER,
      status: "active",
    });

    const tokens = await issueTokenPair(customer);

    return {
      customer: sanitizeCustomer(customer),
      ...tokens,
    };
  }

  static async login(payload) {
    const identifier = payload.identifier || payload.email;
    const customer = await findCustomerByIdentifier(identifier ?? "");
    if (!customer) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const isValidPassword = await EncryptionServices.compare({
      text: payload.password,
      encryptedText: customer.password,
    });

    if (!isValidPassword) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const tokens = await issueTokenPair(customer);

    return {
      customer: sanitizeCustomer(customer),
      ...tokens,
    };
  }

  static async requestLoginOtp(payload) {
    const customer = await CustomerModel.findOne({
      email: payload.email.toLowerCase().trim(),
    });

    if (!customer) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const isValidPassword = await EncryptionServices.compare({
      text: payload.password,
      encryptedText: customer.password,
    });

    if (!isValidPassword) {
      throw new UnauthorizedError("Invalid credentials");
    }

    if (!phonesMatch(customer.phone, payload.phone)) {
      throw new UnauthorizedError("Phone number does not match contract");
    }

    pruneExpiredOtpSessions();

    const otpToken = randomUUID();
    const code = generateOtpCode();

    loginOtpSessions.set(otpToken, {
      customerId: customer._id.toString(),
      code,
      attempts: 0,
      expiresAt: Date.now() + LOGIN_OTP_EXPIRY_MS,
    });

    await sendLoginOtpSms({ phone: customer.phone, code });

    return {
      otpToken,
      expiresInSeconds: Math.floor(LOGIN_OTP_EXPIRY_MS / 1000),
      destinationPhone: customer.phone,
      maskedPhone: maskPhone(customer.phone),
    };
  }

  static async verifyLoginOtp(payload) {
    pruneExpiredOtpSessions();

    const otpToken = payload.otpToken?.toString().trim();
    const code = payload.code?.toString().trim();
    const session = otpToken ? loginOtpSessions.get(otpToken) : null;

    if (!session) {
      throw new UnauthorizedError("Verification session expired");
    }

    if (session.expiresAt <= Date.now()) {
      loginOtpSessions.delete(otpToken);
      throw new UnauthorizedError("Verification session expired");
    }

    if (session.attempts >= LOGIN_OTP_MAX_ATTEMPTS) {
      loginOtpSessions.delete(otpToken);
      throw new UnauthorizedError("Too many invalid verification attempts");
    }

    if (session.code !== code) {
      session.attempts += 1;
      loginOtpSessions.set(otpToken, session);

      if (session.attempts >= LOGIN_OTP_MAX_ATTEMPTS) {
        loginOtpSessions.delete(otpToken);
      }

      throw new UnauthorizedError("Invalid verification code");
    }

    loginOtpSessions.delete(otpToken);

    const customer = await CustomerModel.findById(session.customerId);
    if (!customer) {
      throw new UnauthorizedError("Account no longer exists");
    }

    const tokens = await issueTokenPair(customer);

    return {
      customer: sanitizeCustomer(customer),
      ...tokens,
    };
  }

  static async refreshToken(payload) {
    const decoded = JwtService.verifyRefresh(payload.refreshToken);
    const customer = await CustomerModel.findById(decoded.id);

    if (!customer?.refreshTokenHash) {
      throw new UnauthorizedError("Refresh token is invalid");
    }

    const isValidRefresh = await EncryptionServices.compare({
      text: payload.refreshToken,
      encryptedText: customer.refreshTokenHash,
    });

    if (!isValidRefresh) {
      throw new UnauthorizedError("Refresh token is invalid");
    }

    const tokens = await issueTokenPair(customer);

    return {
      customer: sanitizeCustomer(customer),
      ...tokens,
    };
  }

  static async logout(customerId) {
    await CustomerModel.findByIdAndUpdate(customerId, { refreshTokenHash: null });
  }
}

export default AuthService;
