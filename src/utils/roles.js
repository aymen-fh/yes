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

/** Prefix used in human-readable IDs (ADM-123456, AGT-123456, …) */
export const ROLE_CODE_PREFIX = Object.freeze({
  [Roles.ADMIN]: "ADM",
  [Roles.DISTRIBUTOR]: "AGT",
  [Roles.SUPPORT]: "TEC",
  [Roles.SYSTEM_ENGINEER]: "ENG",
  [Roles.CUSTOMER_SERVICE]: "CSO",
  [Roles.CUSTOMER]: "CUS",
});

export const getRoleCodePrefix = (role) => ROLE_CODE_PREFIX[role] ?? "USR";
