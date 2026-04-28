import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Oxygen ISP API",
      version: "2.0.0",
      description: "ISP Management API for customers, plans, subscriptions, payments, devices, and admin operations.",
      contact: {
        name: "Oxygen API Team",
        email: "api@oxygen.local",
      },
    },
    servers: [
      {
        url: "/api/v1",
        description: "Oxygen API base path",
      },
    ],
    tags: [
      { name: "Auth", description: "Authentication and token lifecycle" },
      { name: "Customers", description: "Customer account management" },
      { name: "Plans", description: "Internet plans catalog" },
      { name: "Subscriptions", description: "Service subscriptions and usage" },
      { name: "Payments", description: "Invoices and payment lifecycle" },
      { name: "Support Tickets", description: "Technical/billing support workflow" },
      { name: "Devices", description: "Routers and CPE inventory" },
      { name: "System", description: "Health and system endpoints" },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        ApiSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Operation successful" },
            data: { type: "object" },
          },
        },
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Validation failed" },
            requestId: { type: "string", example: "39d6a840-9f30-4f31-8d8f-cc5cbf40f903" },
          },
        },
        Customer: {
          type: "object",
          properties: {
            id: { type: "string" },
            customerCode: { type: "string", example: "CUS-100201" },
            fullName: { type: "string", example: "Sara Adel" },
            email: { type: "string", format: "email", example: "sara@demo.com" },
            phone: { type: "string", example: "+201000000111" },
            address: { type: "string", example: "Cairo" },
            role: { type: "string", enum: ["customer", "admin", "distributor", "support"] },
            status: { type: "string", enum: ["active", "suspended", "pending"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Plan: {
          type: "object",
          properties: {
            id: { type: "string" },
            code: { type: "string", example: "PRO120" },
            name: { type: "string", example: "Pro 120 Mbps" },
            speedMbps: { type: "integer", example: 120 },
            dataLimitGb: { type: "integer", example: 1800 },
            monthlyPrice: { type: "number", example: 52 },
            durationMonths: { type: "integer", example: 1 },
            vatPercent: { type: "number", example: 15 },
            isActive: { type: "boolean", example: true },
          },
        },
        Subscription: {
          type: "object",
          properties: {
            id: { type: "string" },
            subscriptionNumber: { type: "string", example: "SUB-555111" },
            status: { type: "string", enum: ["active", "pending", "suspended", "cancelled"] },
            assignedIp: { type: "string", example: "100.64.0.42" },
            dataUsageGb: { type: "number", example: 312 },
            nextBillingDate: { type: "string", format: "date-time" },
            customerId: { $ref: "#/components/schemas/Customer" },
            planId: { $ref: "#/components/schemas/Plan" },
          },
        },
        Payment: {
          type: "object",
          properties: {
            id: { type: "string" },
            invoiceNumber: { type: "string", example: "INV-900221" },
            amount: { type: "number", example: 52 },
            vatAmount: { type: "number", example: 7.8 },
            totalAmount: { type: "number", example: 59.8 },
            currency: { type: "string", example: "EGP" },
            method: { type: "string", enum: ["cash", "card", "bank_transfer", "wallet"] },
            status: { type: "string", enum: ["pending", "paid", "failed", "refunded"] },
            dueDate: { type: "string", format: "date-time" },
            paidAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        Device: {
          type: "object",
          properties: {
            id: { type: "string" },
            serialNumber: { type: "string", example: "DEV-1001" },
            model: { type: "string", example: "MikroTik hAP ax2" },
            macAddress: { type: "string", example: "AA:BB:CC:11:22:33" },
            ipAddress: { type: "string", example: "10.10.0.21" },
            status: { type: "string", enum: ["online", "offline", "maintenance", "fault"] },
          },
        },
      },
    },
    paths: {
      "/health": {
        get: {
          tags: ["System"],
          summary: "API health endpoint",
          responses: {
            "200": { description: "Service healthy" },
          },
        },
      },
      "/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register customer self-service account",
          security: [],
          responses: {
            "201": { description: "Customer account created" },
            "400": { description: "Validation failed", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Authenticate by email or customer code",
          security: [],
          responses: {
            "200": { description: "Login successful" },
            "401": { description: "Invalid credentials" },
          },
        },
      },
      "/auth/refresh-token": {
        post: {
          tags: ["Auth"],
          summary: "Issue new access and refresh tokens",
          security: [],
          responses: {
            "200": { description: "Token refreshed" },
            "401": { description: "Invalid refresh token" },
          },
        },
      },
      "/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Invalidate active refresh token",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Logged out" },
          },
        },
      },
      "/customers": {
        get: {
          tags: ["Customers"],
          summary: "List customers (admin/distributor/support only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Customers list" },
            "403": { description: "Forbidden" },
          },
        },
        post: {
          tags: ["Customers"],
          summary: "Create customer (admin only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "201": { description: "Customer created" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/customers/me": {
        get: {
          tags: ["Customers"],
          summary: "Get current authenticated customer",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": {
              description: "Current customer profile",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/ApiSuccess" },
                      {
                        type: "object",
                        properties: {
                          data: { $ref: "#/components/schemas/Customer" },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      "/customers/{id}": {
        get: {
          tags: ["Customers"],
          summary: "Get customer by id (self or staff)",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Customer details" },
            "403": { description: "Forbidden" },
          },
        },
        patch: {
          tags: ["Customers"],
          summary: "Update customer (self or staff)",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Customer updated" },
            "403": { description: "Forbidden" },
          },
        },
        delete: {
          tags: ["Customers"],
          summary: "Delete customer (admin only)",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Customer deleted" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/plans": {
        get: {
          tags: ["Plans"],
          summary: "List plans",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Plans list" },
          },
        },
        post: {
          tags: ["Plans"],
          summary: "Create plan (admin only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "201": { description: "Plan created" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/plans/{id}": {
        get: {
          tags: ["Plans"],
          summary: "Get plan details",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Plan details" },
          },
        },
        patch: {
          tags: ["Plans"],
          summary: "Update plan (admin only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Plan updated" },
          },
        },
        delete: {
          tags: ["Plans"],
          summary: "Delete plan (admin only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Plan deleted" },
          },
        },
      },
      "/subscriptions": {
        get: {
          tags: ["Subscriptions"],
          summary: "List subscriptions (customer sees own records only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Subscriptions list" },
          },
        },
        post: {
          tags: ["Subscriptions"],
          summary: "Create subscription (admin/distributor/support only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "201": { description: "Subscription created" },
          },
        },
      },
      "/subscriptions/{id}": {
        get: {
          tags: ["Subscriptions"],
          summary: "Get subscription (customer limited to own)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Subscription details" },
          },
        },
        patch: {
          tags: ["Subscriptions"],
          summary: "Update subscription (admin/distributor/support only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Subscription updated" },
          },
        },
      },
      "/subscriptions/{id}/usage": {
        get: {
          tags: ["Subscriptions"],
          summary: "Get subscription usage snapshot",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Usage payload" },
          },
        },
      },
      "/subscriptions/{id}/renew": {
        post: {
          tags: ["Subscriptions"],
          summary: "Renew subscription and generate invoice",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Subscription renewed" },
            "404": { description: "Subscription not found" },
          },
        },
      },
      "/payments": {
        get: {
          tags: ["Payments"],
          summary: "List invoices (customer sees own records only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Payments list" },
          },
        },
        post: {
          tags: ["Payments"],
          summary: "Create invoice (admin/distributor/support only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "201": { description: "Payment created" },
          },
        },
      },
      "/payments/stats": {
        get: {
          tags: ["Payments"],
          summary: "Billing statistics (admin/distributor/support only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Stats payload" },
          },
        },
      },
      "/payments/{id}": {
        get: {
          tags: ["Payments"],
          summary: "Get invoice details (customer limited to own)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Payment details" },
          },
        },
        patch: {
          tags: ["Payments"],
          summary: "Update invoice (admin/distributor/support only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Payment updated" },
          },
        },
      },
      "/support-tickets": {
        get: {
          tags: ["Support Tickets"],
          summary: "List support tickets",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Support tickets list" },
          },
        },
        post: {
          tags: ["Support Tickets"],
          summary: "Create support ticket",
          security: [{ BearerAuth: [] }],
          responses: {
            "201": { description: "Support ticket created" },
          },
        },
      },
      "/support-tickets/{id}": {
        get: {
          tags: ["Support Tickets"],
          summary: "Get support ticket details",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Support ticket details" },
          },
        },
        patch: {
          tags: ["Support Tickets"],
          summary: "Update support ticket (staff only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Support ticket updated" },
          },
        },
      },
      "/support-tickets/{id}/replies": {
        post: {
          tags: ["Support Tickets"],
          summary: "Add reply to support ticket",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Reply added" },
          },
        },
      },
      "/devices": {
        get: {
          tags: ["Devices"],
          summary: "List devices (admin/distributor/support only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Device list" },
          },
        },
        post: {
          tags: ["Devices"],
          summary: "Create device (admin/distributor/support only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "201": { description: "Device created" },
          },
        },
      },
      "/devices/{id}": {
        get: {
          tags: ["Devices"],
          summary: "Get device by id (admin/distributor/support only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Device details" },
          },
        },
        patch: {
          tags: ["Devices"],
          summary: "Update device (admin/distributor/support only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Device updated" },
          },
        },
        delete: {
          tags: ["Devices"],
          summary: "Delete device (admin only)",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": { description: "Device deleted" },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
