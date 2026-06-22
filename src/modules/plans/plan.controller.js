import { ApiResponse } from "../../utils/apiResponse.js";
import { NotFoundError } from "../../utils/errors.js";
import { getCustomerDomainModels } from "../../utils/roleModels.js";
import { serializeDoc, serializeDocs } from "../common/serializers.js";
import { toPlanMobileDto } from "../../utils/mobileDto.js";

const buildPlanQuery = ({ isActive, search, includeInactive }) => {
  const query = {};

  if (typeof isActive === "string") {
    query.isActive = isActive === "true";
  } else if (includeInactive !== "true") {
    query.isActive = true;
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
      const { Plan } = getCustomerDomainModels();
      const { page, limit, isActive, search, includeInactive } = req.query;
      const query = buildPlanQuery({ isActive, search, includeInactive });

      const [items, total] = await Promise.all([
        Plan.find(query)
          .sort({ monthlyPrice: 1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Plan.countDocuments(query),
      ]);

      return ApiResponse.paginated(res, items.map((item) => toPlanMobileDto(item)), total, page, limit);
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { Plan } = getCustomerDomainModels();
      const plan = await Plan.findById(req.params.id);
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
      const { Plan } = getCustomerDomainModels();
      const payload = {
        ...req.body,
        code: req.body.code.toUpperCase().trim(),
      };

      const plan = await Plan.create(payload);
      return ApiResponse.created(res, serializeDoc(plan), "Plan created successfully");
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { Plan } = getCustomerDomainModels();
      const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, {
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
      const { Plan } = getCustomerDomainModels();
      const deleted = await Plan.findByIdAndDelete(req.params.id);
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
