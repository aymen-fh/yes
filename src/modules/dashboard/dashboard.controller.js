import { ApiResponse } from "../../utils/apiResponse.js";
import { Roles } from "../../utils/roles.js";
import { getModelsForRole } from "../../utils/roleModels.js";
import { serializeDoc } from "../common/serializers.js";
import DashboardService from "./dashboard.service.js";
import {
  AgentProfile,
  CouponCard,
  DailyReport,
  AuditLog,
  SystemPermission,
  AgentRequest,
  InternalMessage,
} from "./dashboard.models.js";
import EncryptionServices from "../../utils/encryptionServices.js";
import { NotFoundError } from "../../utils/errors.js";
import { createReadableCode } from "../common/serializers.js";

const DEFAULT_PERMISSIONS = [
  { role: "admin", module: "customers", canView: true, canCreate: true, canEdit: true, canDelete: true },
  { role: "admin", module: "agents", canView: true, canCreate: true, canEdit: true, canDelete: true },
  { role: "agent", module: "customers", canView: true, canCreate: false, canEdit: true, canDelete: false },
  { role: "tech_support", module: "complaints", canView: true, canCreate: false, canEdit: true, canDelete: false },
  { role: "customer_service", module: "complaints", canView: true, canCreate: true, canEdit: true, canDelete: false },
];

class DashboardController {
  static async bootstrap(req, res, next) {
    try {
      await DashboardService.seedDefaultPermissions(DEFAULT_PERMISSIONS);
      const data = await DashboardService.bootstrap();
      return ApiResponse.success(res, data);
    } catch (error) {
      return next(error);
    }
  }

  static async createCustomer(req, res, next) {
    try {
      const { Customer } = getModelsForRole(Roles.CUSTOMER);
      const customerCode = createReadableCode("CUST");
      const password = await EncryptionServices.encryptText(req.body.password || "customer123");
      const customer = await Customer.create({
        customerCode,
        fullName: req.body.name,
        email: req.body.email,
        password,
        phone: req.body.phone,
        address: req.body.region || "",
        role: Roles.CUSTOMER,
        status: req.body.status || "active",
      });
      return ApiResponse.created(res, serializeDoc(customer), "Customer created");
    } catch (error) {
      return next(error);
    }
  }

  static async updateCustomer(req, res, next) {
    try {
      const { Customer } = getModelsForRole(Roles.CUSTOMER);
      const customer = await Customer.findByIdAndUpdate(
        req.params.id,
        {
          fullName: req.body.name,
          phone: req.body.phone,
          address: req.body.region,
          status: req.body.status,
        },
        { new: true }
      );
      if (!customer) throw new NotFoundError("Customer not found");
      return ApiResponse.success(res, serializeDoc(customer), "Customer updated");
    } catch (error) {
      return next(error);
    }
  }

  static async deleteCustomer(req, res, next) {
    try {
      const { Customer } = getModelsForRole(Roles.CUSTOMER);
      await Customer.findByIdAndDelete(req.params.id);
      return ApiResponse.success(res, null, "Customer deleted");
    } catch (error) {
      return next(error);
    }
  }

  static async createAgent(req, res, next) {
    try {
      const data = await DashboardService.createAgent(req.body);
      return ApiResponse.created(res, data.profile, "Agent created");
    } catch (error) {
      return next(error);
    }
  }

  static async updateAgent(req, res, next) {
    try {
      const data = await DashboardService.updateAgent(req.params.id, req.body);
      return ApiResponse.success(res, data, "Agent updated");
    } catch (error) {
      return next(error);
    }
  }

  static async deleteAgent(req, res, next) {
    try {
      await DashboardService.deleteAgent(req.params.id);
      return ApiResponse.success(res, null, "Agent deleted");
    } catch (error) {
      return next(error);
    }
  }

  static async topUpAgent(req, res, next) {
    try {
      const data = await DashboardService.topUpAgent(req.params.id, Number(req.body.amount) || 0);
      return ApiResponse.success(res, data, "Agent topped up");
    } catch (error) {
      return next(error);
    }
  }

  static async createStaffUser(req, res, next) {
    try {
      const data = await DashboardService.createStaffUser(req.body);
      return ApiResponse.created(res, data, "User created");
    } catch (error) {
      return next(error);
    }
  }

  static async updateStaffUser(req, res, next) {
    try {
      const data = await DashboardService.updateStaffUser(req.params.id, req.query.role, req.body);
      return ApiResponse.success(res, data, "User updated");
    } catch (error) {
      return next(error);
    }
  }

  static async deleteStaffUser(req, res, next) {
    try {
      await DashboardService.deleteStaffUser(req.params.id);
      return ApiResponse.success(res, null, "User deleted");
    } catch (error) {
      return next(error);
    }
  }

  static async generateCards(req, res, next) {
    try {
      const cards = await DashboardService.generateCards({
        value: Number(req.body.value) || 20,
        count: Math.min(Number(req.body.count) || 1, 100),
      });
      return ApiResponse.created(res, cards, "Cards generated");
    } catch (error) {
      return next(error);
    }
  }

  static async deleteCard(req, res, next) {
    try {
      await CouponCard().findByIdAndDelete(req.params.id);
      return ApiResponse.success(res, null, "Card deleted");
    } catch (error) {
      return next(error);
    }
  }

  static async createReport(req, res, next) {
    try {
      const reportCode = createReadableCode("REP");
      const report = await DailyReport().create({ ...req.body, reportCode });
      return ApiResponse.created(res, serializeDoc(report), "Report created");
    } catch (error) {
      return next(error);
    }
  }

  static async createAuditLog(req, res, next) {
    try {
      const log = await DashboardService.createAuditLog(req.body);
      return ApiResponse.created(res, log, "Audit log created");
    } catch (error) {
      return next(error);
    }
  }

  static async upsertPermissions(req, res, next) {
    try {
      const data = await DashboardService.upsertPermissions(req.body.permissions || []);
      return ApiResponse.success(res, data, "Permissions updated");
    } catch (error) {
      return next(error);
    }
  }

  static async updateRequest(req, res, next) {
    try {
      const data = await DashboardService.updateRequest(req.params.id, req.body);
      return ApiResponse.success(res, data, "Request updated");
    } catch (error) {
      return next(error);
    }
  }

  static async createRequest(req, res, next) {
    try {
      const requestCode = createReadableCode("REQ");
      const item = await AgentRequest().create({ ...req.body, requestCode });
      return ApiResponse.created(res, serializeDoc(item), "Request created");
    } catch (error) {
      return next(error);
    }
  }

  static async createMessage(req, res, next) {
    try {
      const data = await DashboardService.createMessage(req.body);
      return ApiResponse.created(res, data, "Message sent");
    } catch (error) {
      return next(error);
    }
  }

  static async markMessageRead(req, res, next) {
    try {
      const data = await DashboardService.markMessageRead(req.params.id);
      return ApiResponse.success(res, data, "Message marked as read");
    } catch (error) {
      return next(error);
    }
  }

  static async updateEngineer(req, res, next) {
    try {
      const { EngineerProfile } = await import("./dashboard.models.js");
      const profile = await EngineerProfile().findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!profile) throw new NotFoundError("Engineer not found");
      return ApiResponse.success(res, serializeDoc(profile), "Engineer updated");
    } catch (error) {
      return next(error);
    }
  }
}

export default DashboardController;
