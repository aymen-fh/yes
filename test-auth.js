import "dotenv/config";
import mongoose from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

import connectToDatabase from "./src/config/db.js";
import { findUserByIdentifierAcrossRoles } from "./src/utils/roleModels.js";

async function check() {
  await connectToDatabase();
  console.log("Connected to MongoDB via db.js!");
  
  const result = await findUserByIdentifierAcrossRoles("admin@yes.com");
  console.log("Result:", result ? "Found" : "NOT found");
  
  process.exit(0);
}

check();
