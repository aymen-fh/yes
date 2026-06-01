import mongoose from "mongoose";
import { Roles } from "./roles.js";

const roleDbCache = new Map();

export const getRoleDbName = (role) => {
  return process.env.MONGO_DB_NAME?.trim() || "oxygen";
};

export const getRoleDb = (role) => {
  const dbName = getRoleDbName(role);
  if (roleDbCache.has(dbName)) {
    return roleDbCache.get(dbName);
  }

  const db = mongoose.connection.useDb(dbName, { useCache: true });
  roleDbCache.set(dbName, db);
  return db;
};

export const getAllRoleDbNames = () => Object.values(Roles).map((role) => getRoleDbName(role));
