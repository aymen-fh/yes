import EncryptionServices from "../../utils/encryptionServices.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { Roles } from "../../utils/roles.js";
import { findUserByIdAcrossRoles, getModelsForRole } from "../../utils/roleModels.js";
import { createReadableCode, serializeDoc, serializeDocs } from "../common/serializers.js";

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

const getUserModel = (role) => getModelsForRole(role).Customer;

const createCustomerCode = async (role) => {
  const Customer = getUserModel(role);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = createReadableCode("CUS");
    const exists = await Customer.exists({ customerCode: code });
    if (!exists) return code;
  }

  return `${createReadableCode("CUS")}-${Date.now().toString().slice(-4)}`;
};

const resolveTargetUser = async ({ requesterRole, roleHint, id }) => {
  if (roleHint) {
    const Customer = getUserModel(roleHint);
    const user = await Customer.findById(id);
    return user ? { user, role: roleHint } : null;
  }

  if (requesterRole === Roles.ADMIN) {
    return findUserByIdAcrossRoles(id);
  }

  const Customer = getUserModel(requesterRole || Roles.CUSTOMER);
  const user = await Customer.findById(id);
  return user ? { user, role: requesterRole } : null;
};

class CustomerController {
  static async me(req, res, next) {
    try {
      const Customer = getUserModel(req.user.role || Roles.CUSTOMER);
      const customer = await Customer.findById(req.user.id);
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
      const role = req.query.role || Roles.CUSTOMER;
      const Customer = getUserModel(role);
      const query = buildCustomerQuery({ status, search });

      const [items, total] = await Promise.all([
        Customer.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Customer.countDocuments(query),
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

      const resolved = await resolveTargetUser({
        requesterRole: req.user.role,
        roleHint: req.query.role,
        id: req.params.id,
      });

      if (!resolved?.user) {
        throw new NotFoundError("Customer not found");
      }

      return ApiResponse.success(res, toCustomerDto(resolved.user));
    } catch (error) {
      return next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const role = req.body.role || Roles.CUSTOMER;
      const Customer = getUserModel(role);
      const customerCode = await createCustomerCode(role);
      const password = await EncryptionServices.encryptText(req.body.password);

      const customer = await Customer.create({
        customerCode,
        fullName: req.body.fullName,
        email: req.body.email.toLowerCase().trim(),
        password,
        phone: req.body.phone,
        address: req.body.address || "",
        role,
        status: req.body.status,
        createdBy: req.user.role === role ? req.user.id : null,
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

      const resolved = await resolveTargetUser({
        requesterRole: req.user.role,
        roleHint: req.query.role,
        id: req.params.id,
      });

      if (!resolved?.user) {
        throw new NotFoundError("Customer not found");
      }

      const Customer = getUserModel(resolved.role);

      const payload = { ...req.body };
      if (req.user.role === "customer") {
        delete payload.role;
        delete payload.status;
      }

      const customer = await Customer.findByIdAndUpdate(resolved.user._id, payload, { new: true });

      return ApiResponse.success(res, toCustomerDto(customer), "Customer updated");
    } catch (error) {
      return next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      const resolved = await resolveTargetUser({
        requesterRole: req.user.role,
        roleHint: req.query.role,
        id: req.params.id,
      });

      if (!resolved?.user) {
        throw new NotFoundError("Customer not found");
      }

      if (req.user.id === resolved.user._id.toString() && req.user.role === resolved.role) {
        throw new ForbiddenError("Admins cannot delete themselves");
      }

      const Customer = getUserModel(resolved.role);
      await Customer.findByIdAndDelete(resolved.user._id);

      return ApiResponse.success(res, null, "Customer deleted");
    } catch (error) {
      return next(error);
    }
  }
}

export default CustomerController;
