import { ApiResponse } from "../../utils/apiResponse.js";
import AuthService from "./auth.service.js";

class AuthController {
  static async register(req, res, next) {
    try {
      const data = await AuthService.register(req.body);
      return ApiResponse.created(res, data, "Customer account created");
    } catch (error) {
      return next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const data = await AuthService.login(req.body);
      return ApiResponse.success(res, data, "Login successful");
    } catch (error) {
      return next(error);
    }
  }

  static async requestLoginOtp(req, res, next) {
    try {
      const data = await AuthService.requestLoginOtp(req.body);
      return ApiResponse.success(res, data, "Verification code sent");
    } catch (error) {
      return next(error);
    }
  }

  static async verifyLoginOtp(req, res, next) {
    try {
      const data = await AuthService.verifyLoginOtp(req.body);
      return ApiResponse.success(res, data, "Login verified");
    } catch (error) {
      return next(error);
    }
  }

  static async refreshToken(req, res, next) {
    try {
      const data = await AuthService.refreshToken(req.body);
      return ApiResponse.success(res, data, "Token refreshed");
    } catch (error) {
      return next(error);
    }
  }

  static async logout(req, res, next) {
    try {
      await AuthService.logout(req.user.id, req.user.role);
      return ApiResponse.success(res, null, "Logged out");
    } catch (error) {
      return next(error);
    }
  }
}

export default AuthController;
