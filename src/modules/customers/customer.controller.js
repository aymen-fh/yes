import EncryptionServices from "../../utils/encryptionServices.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { createReadableCode, serializeDoc, serializeDocs } from "../common/serializers.js";
import CustomerModel from "./customer.model.js";

const buildCustomerQuery = ({ status, search }) => {
  const query = {};

  if (status) {
    query.status = status;
  }

  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { customerCode: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  return query;
};

const toCustomerDto = (customer) =>
  serializeDoc(customer, {
    exclude: ["password", "refreshTokenHash"],
  });

const createCustomerCode = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = createReadableCode("CUS");
    const exists = await CustomerModel.exists({ customerCode: code });
    if (!exists) return code;
  }

  return `${createReadableCode("CUS")}-${Date.now().toString().slice(-4)}`;
};

class CustomerController {
  static async me(req, res, next) {
    try {
      const customer = await CustomerModel.findById(req.user.id);
      if (!customer) {
        throw new NotFoundError("Customer not found");
      }

      return ApiResponse.success(res, toCustomerDto(customer));
    } catch (error) {
      return next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const { page, limit, status, search } = req.query;
      const query = buildCustomerQuery({ status, search });

      const [items, total] = await Promise.all([
        CustomerModel.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        CustomerModel.countDocuments(query),
      ]);

      return ApiResponse.paginated(
        res,
        serializeDocs(items, { exclude: ["password", "refreshTokenHash"] }),
        total,
        page,
        limit
      );
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      if (req.user.role === "customer" && req.user.id !== req.params.id) {
        throw new ForbiddenError("You can only access your own account");
      }

      const customer = await CustomerModel.findById(req.params.id);
      if (!customer) {
        throw new NotFoundError("Customer not found");
      }

      return ApiResponse.success(res, toCustomerDto(customer));
    } catch (error) {
      return next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const customerCode = await createCustomerCode();
      const password = await EncryptionServices.encryptText(req.body.password);

      const customer = await CustomerModel.create({
        customerCode,
        fullName: req.body.fullName,
        email: req.body.email.toLowerCase().trim(),
        password,
        phone: req.body.phone,
        address: req.body.address || "",
        role: req.body.role,
        status: req.body.status,
        createdBy: req.user.id,
      });

      return ApiResponse.created(res, toCustomerDto(customer), "Customer created successfully");
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      if (req.user.role === "customer" && req.user.id !== req.params.id) {
        throw new ForbiddenError("You can only update your own account");
      }

      const payload = { ...req.body };
      if (req.user.role === "customer") {
        delete payload.role;
        delete payload.status;
      }

      const customer = await CustomerModel.findByIdAndUpdate(req.params.id, payload, { new: true });
      if (!customer) {
        throw new NotFoundError("Customer not found");
      }

      return ApiResponse.success(res, toCustomerDto(customer), "Customer updated");
    } catch (error) {
      return next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      if (req.user.id === req.params.id) {
        throw new ForbiddenError("Admins cannot delete themselves");
      }

      const deleted = await CustomerModel.findByIdAndDelete(req.params.id);
      if (!deleted) {
        throw new NotFoundError("Customer not found");
      }

      return ApiResponse.success(res, null, "Customer deleted");
    } catch (error) {
      return next(error);
    }
  }
}

export default CustomerController;
