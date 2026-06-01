import JwtService from "../utils/jwtServices.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";
import { Roles } from "../utils/roles.js";
import { getModelsForRole } from "../utils/roleModels.js";

export const requireAuth = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new UnauthorizedError("Authorization token is required"));
    }

    const token = authHeader.split(" ")[1];
    const payload = JwtService.verify(token);
    const role = payload.role || Roles.CUSTOMER;
    const { Customer } = getModelsForRole(role);

    const currentCustomer = await Customer.findById(payload.id);
    if (!currentCustomer) {
      return next(new UnauthorizedError("Account no longer exists"));
    }

    if (currentCustomer.status === "suspended") {
      return next(new ForbiddenError("Your account is suspended"));
    }

    req.user = {
      id: currentCustomer._id.toString(),
      role: currentCustomer.role,
      status: currentCustomer.status,
      email: currentCustomer.email,
      customerCode: currentCustomer.customerCode,
    };

    return next();
  } catch (_error) {
    return next(new UnauthorizedError("Invalid or expired token"));
  }
};

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError("Authentication required"));
  }

  if (!roles.includes(req.user.role)) {
    return next(new ForbiddenError("You do not have permission to perform this action"));
  }

  return next();
};

export const requireSelfOrRole = (paramName, ...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError("Authentication required"));
  }

  const targetValue = req.params?.[paramName];
  const isSelf = targetValue && req.user.id === targetValue;
  const hasRole = roles.includes(req.user.role);

  if (!isSelf && !hasRole) {
    return next(new ForbiddenError("You do not have permission to access this resource"));
  }

  return next();
};
