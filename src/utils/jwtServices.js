import jwt from "jsonwebtoken";

class JwtService {
  static sign(payload) {
    this.#ensureSecret();
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "2h",
    });
  }


  static signRefresh(payload) {
    this.#ensureSecret();
    return jwt.sign(
      payload,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + "_refresh",
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
      }
    );
  }

  static verify(token) {
    this.#ensureSecret();
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  static verifyRefresh(token) {
    this.#ensureSecret();
    return jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + "_refresh"
    );
  }

  static decode(token) {
    return jwt.decode(token);
  }

  static #ensureSecret() {
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
  }

  // Keep old name for backwards compat
  static ensureJwtSecretIsSet() {
    this.#ensureSecret();
  }
}

export default JwtService;
