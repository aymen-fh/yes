import { randomInt, randomUUID } from "node:crypto";

import EncryptionServices from "../../utils/encryptionServices.js";
import JwtService from "../../utils/jwtServices.js";
import { ConflictError, UnauthorizedError } from "../../utils/errors.js";
import { Roles } from "../../utils/roles.js";
import { findUserByIdentifierAcrossRoles, getModelsForRole } from "../../utils/roleModels.js";
import { createReadableCode, serializeDoc } from "../common/serializers.js";
import { sendOtpEmail, maskEmail } from "../../utils/otpMail.js";

const LOGIN_OTP_EXPIRY_MS = 5 * 60 * 1000;
const LOGIN_OTP_MAX_ATTEMPTS = 5;
const loginOtpSessions = new Map();

const generateOtpCode = () => String(randomInt(0, 1000000)).padStart(6, "0");

const pruneExpiredOtpSessions = () => {
  const now = Date.now();

  for (const [otpToken, session] of loginOtpSessions.entries()) {
    if (session.expiresAt <= now) {
      loginOtpSessions.delete(otpToken);
    }
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
  const { Customer } = getModelsForRole(Roles.CUSTOMER);
  // Retry random code generation to avoid unique index collisions.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = createReadableCode("CUS");
    const exists = await Customer.exists({ customerCode: candidate });
    if (!exists) return candidate;
  }

  return `${createReadableCode("CUS")}-${Date.now().toString().slice(-4)}`;
};

const issueTokenPair = async (customer) => {
  const { Customer } = getModelsForRole(customer.role);
  const token = JwtService.sign(toAuthPayload(customer));
  const refreshToken = JwtService.signRefresh({ id: customer._id.toString(), role: customer.role });
  const refreshTokenHash = await EncryptionServices.encryptText(refreshToken);

  await Customer.findByIdAndUpdate(customer._id, {
    refreshTokenHash,
    lastLoginAt: new Date(),
  });

  return { token, refreshToken };
};

const buildAuthResponse = (customer, tokens) => {
  const profile = sanitizeCustomer(customer);

  return {
    user: profile,
    customer: profile,
    accessToken: tokens.token,
    token: tokens.token,
    refreshToken: tokens.refreshToken,
  };
};

const findCustomerByIdentifier = async (identifier) =>
  findUserByIdentifierAcrossRoles(identifier);

class AuthService {
  static async register(payload) {
    const { Customer } = getModelsForRole(Roles.CUSTOMER);
    const existing = await Customer.findOne({ email: payload.email.toLowerCase() });
    if (existing) {
      throw new ConflictError("Email already in use");
    }

    const customerCode = await createUniqueCustomerCode();
    const password = await EncryptionServices.encryptText(payload.password);

    const customer = await Customer.create({
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

    return buildAuthResponse(customer, tokens);
  }

  static async login(payload) {
    const identifier = payload.identifier || payload.email;
    const result = await findCustomerByIdentifier(identifier ?? "");
    const customer = result?.user;
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

    return buildAuthResponse(customer, tokens);
  }

  static async requestLoginOtp(payload) {
    const result = await findCustomerByIdentifier(payload.email);
    const customer = result?.user;
    const role = result?.role || customer?.role;

    if (!customer) {
      throw new UnauthorizedError("Invalid credentials");
    }

    if (!payload.skipPasswordCheck) {
      const isValidPassword = await EncryptionServices.compare({
        text: payload.password,
        encryptedText: customer.password,
      });

      if (!isValidPassword) {
        throw new UnauthorizedError("Invalid credentials");
      }
    }

    if (!customer?.email?.trim()) {
      throw new UnauthorizedError("No email registered for this account");
    }

    pruneExpiredOtpSessions();

    const otpToken = randomUUID();
    const code = generateOtpCode();
    const purpose =
      payload.purpose === "password_recovery" ? "password_recovery" : "login";

    loginOtpSessions.set(otpToken, {
      customerId: customer._id.toString(),
      role: role || customer.role,
      code,
      purpose,
      attempts: 0,
      expiresAt: Date.now() + LOGIN_OTP_EXPIRY_MS,
    });

    await sendOtpEmail({ email: customer.email, code, purpose });

    const masked = maskEmail(customer.email);
    const response = {
      requestId: otpToken,
      otpToken,
      expiresInSec: Math.floor(LOGIN_OTP_EXPIRY_MS / 1000),
      expiresInSeconds: Math.floor(LOGIN_OTP_EXPIRY_MS / 1000),
      maskedDestination: masked,
      maskedEmail: masked,
      destinationEmail: customer.email,
      purpose,
    };

    if (process.env.NODE_ENV !== "production" && process.env.OTP_DEBUG === "true") {
      response.debugCode = code;
    }

    return response;
  }

  static async requestRecoveryOtp(payload) {
    return AuthService.requestLoginOtp({
      email: payload.email,
      purpose: "password_recovery",
      skipPasswordCheck: true,
    });
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

    const { Customer } = getModelsForRole(session.role || Roles.CUSTOMER);
    const customer = await Customer.findById(session.customerId);
    if (!customer) {
      throw new UnauthorizedError("Account no longer exists");
    }

    if (session.purpose === "password_recovery") {
      return {
        verified: true,
        purpose: "password_recovery",
        maskedEmail: maskEmail(customer.email),
      };
    }

    const tokens = await issueTokenPair(customer);

    return buildAuthResponse(customer, tokens);
  }

  static async refreshToken(payload) {
    const decoded = JwtService.verifyRefresh(payload.refreshToken);
    const { Customer } = getModelsForRole(decoded.role || Roles.CUSTOMER);
    const customer = await Customer.findById(decoded.id);

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

    return buildAuthResponse(customer, tokens);
  }

  static async logout(customerId, role = Roles.CUSTOMER) {
    const { Customer } = getModelsForRole(role);
    await Customer.findByIdAndUpdate(customerId, { refreshTokenHash: null });
  }
}

export default AuthService;
