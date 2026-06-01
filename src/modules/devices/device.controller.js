import { ApiResponse } from "../../utils/apiResponse.js";
import { NotFoundError } from "../../utils/errors.js";
import { getCustomerDomainModels } from "../../utils/roleModels.js";
import { serializeDoc, serializeDocs } from "../common/serializers.js";

const buildDeviceQuery = ({ status, customerId }) => {
  const query = {};

  if (status) {
    query.status = status;
  }

  if (customerId) {
    query.customerId = customerId;
  }

  return query;
};

class DeviceController {
  static async list(req, res, next) {
    try {
      const { Device } = getCustomerDomainModels();
      const { page, limit, status, customerId } = req.query;
      const query = buildDeviceQuery({ status, customerId });

      const [items, total] = await Promise.all([
        Device.find(query)
          .populate("customerId", "fullName customerCode email")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Device.countDocuments(query),
      ]);

      return ApiResponse.paginated(res, serializeDocs(items), total, page, limit);
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { Device } = getCustomerDomainModels();
      const device = await Device.findById(req.params.id).populate(
        "customerId",
        "fullName customerCode email"
      );
      if (!device) {
        throw new NotFoundError("Device not found");
      }

      return ApiResponse.success(res, serializeDoc(device));
    } catch (error) {
      return next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const { Device } = getCustomerDomainModels();
      const payload = {
        ...req.body,
        serialNumber: req.body.serialNumber.toUpperCase().trim(),
        macAddress: req.body.macAddress.toUpperCase().trim(),
      };

      const device = await Device.create(payload);
      return ApiResponse.created(res, serializeDoc(device), "Device created successfully");
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { Device } = getCustomerDomainModels();
      const device = await Device.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      }).populate("customerId", "fullName customerCode email");

      if (!device) {
        throw new NotFoundError("Device not found");
      }

      return ApiResponse.success(res, serializeDoc(device), "Device updated");
    } catch (error) {
      return next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      const { Device } = getCustomerDomainModels();
      const deleted = await Device.findByIdAndDelete(req.params.id);
      if (!deleted) {
        throw new NotFoundError("Device not found");
      }

      return ApiResponse.success(res, null, "Device removed");
    } catch (error) {
      return next(error);
    }
  }
}

export default DeviceController;
