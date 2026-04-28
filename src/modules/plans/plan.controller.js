import { ApiResponse } from "../../utils/apiResponse.js";
import { NotFoundError } from "../../utils/errors.js";
import { serializeDoc, serializeDocs } from "../common/serializers.js";
import PlanModel from "./plan.model.js";

const buildPlanQuery = ({ isActive, search }) => {
  const query = {};

  if (typeof isActive === "string") {
    query.isActive = isActive === "true";
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
    ];
  }

  return query;
};

class PlanController {
  static async list(req, res, next) {
    try {
      const { page, limit, isActive, search } = req.query;
      const query = buildPlanQuery({ isActive, search });

      const [items, total] = await Promise.all([
        PlanModel.find(query)
          .sort({ monthlyPrice: 1 })
          .skip((page - 1) * limit)
          .limit(limit),
        PlanModel.countDocuments(query),
      ]);

      return ApiResponse.paginated(res, serializeDocs(items), total, page, limit);
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const plan = await PlanModel.findById(req.params.id);
      if (!plan) {
        throw new NotFoundError("Plan not found");
      }

      return ApiResponse.success(res, serializeDoc(plan));
    } catch (error) {
      return next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const payload = {
        ...req.body,
        code: req.body.code.toUpperCase().trim(),
      };

      const plan = await PlanModel.create(payload);
      return ApiResponse.created(res, serializeDoc(plan), "Plan created successfully");
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const plan = await PlanModel.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });

      if (!plan) {
        throw new NotFoundError("Plan not found");
      }

      return ApiResponse.success(res, serializeDoc(plan), "Plan updated");
    } catch (error) {
      return next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      const deleted = await PlanModel.findByIdAndDelete(req.params.id);
      if (!deleted) {
        throw new NotFoundError("Plan not found");
      }

      return ApiResponse.success(res, null, "Plan deleted");
    } catch (error) {
      return next(error);
    }
  }
}

export default PlanController;
