import "dotenv/config";
import mongoose from "mongoose";
import dns from "dns";
import bcrypt from "bcryptjs";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function check() {
  await mongoose.connect(process.env.MONGO_URL, { dbName: process.env.MONGO_DB_NAME });
  console.log("Connected to MongoDB!");
  
  const db = mongoose.connection.getClient().db(process.env.MONGO_DB_NAME);
  const collections = await db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));
  
  const admin = await db.collection("admins").findOne({ email: "admin@yes.com" });
  if (!admin) {
    console.log("Admin not found!");
  } else {
    console.log("Admin found:", admin.email);
    const match = await bcrypt.compare("admin123", admin.password);
    console.log("Password match:", match);
  }
  process.exit(0);
}

check();
