export const Roles = Object.freeze({
  ADMIN: "admin",
  DISTRIBUTOR: "agent",
  SUPPORT: "tech_support",
  SYSTEM_ENGINEER: "system_engineer",
  CUSTOMER_SERVICE: "customer_service",
  CUSTOMER: "customer",
});

export const STAFF_ROLES = Object.freeze([
  Roles.ADMIN,
  Roles.DISTRIBUTOR,
  Roles.SUPPORT,
  Roles.SYSTEM_ENGINEER,
  Roles.CUSTOMER_SERVICE,
]);
