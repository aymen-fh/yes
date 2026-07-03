import { ApiResponse } from "../../utils/apiResponse.js";
import ServicePointController from "../servicePoints/servicePoint.controller.js";
import { chatWithOxy } from "./oxy.service.js";

class MobileController {
  static async listLocations(req, res, next) {
    return ServicePointController.list(req, res, next);
  }

  static async oxyChat(req, res, next) {
    try {
      const { message, history, context } = req.body || {};
      const result = await chatWithOxy({
        message,
        history: Array.isArray(history) ? history : [],
        context: context && typeof context === "object" ? context : {},
      });

      return ApiResponse.success(res, result, "OXY reply");
    } catch (error) {
      return next(error);
    }
  }
}

export default MobileController;
