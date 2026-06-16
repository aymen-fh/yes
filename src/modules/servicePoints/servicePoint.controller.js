import { ApiResponse } from "../../utils/apiResponse.js";
import { getCustomerDomainModels } from "../../utils/roleModels.js";
import { serializeDocs } from "../common/serializers.js";
import { defaultServicePoints } from "./servicePoint.defaults.js";

const ensureDefaultServicePoints = async (ServicePoint) => {
  const count = await ServicePoint.countDocuments();
  if (count > 0) return;

  await ServicePoint.insertMany(defaultServicePoints);
};

class ServicePointController {
  static async list(req, res, next) {
    try {
      const { ServicePoint } = getCustomerDomainModels();
      await ensureDefaultServicePoints(ServicePoint);

      const items = await ServicePoint.find({ isActive: true }).sort({ name: 1 });
      return ApiResponse.success(res, serializeDocs(items));
    } catch (error) {
      return next(error);
    }
  }
}

export default ServicePointController;
