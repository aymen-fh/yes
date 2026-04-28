import mongoose from "mongoose";
import dotenv from "dotenv";
import CustomerModel from "../src/modules/customers/customer.model.js";

dotenv.config();

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      dbName: process.env.MONGO_DB_NAME,
    });
    console.log("Connected to MongoDB for migration...");

    const result = await CustomerModel.updateMany(
      { role: { $exists: false } },
      { $set: { role: "customer" } }
    );

    console.log(`Updated ${result.modifiedCount} records to 'customer' role.`);

    const statusResult = await CustomerModel.updateMany(
      { status: { $exists: false } },
      { $set: { status: "active" } }
    );

    console.log(`Updated ${statusResult.modifiedCount} records to 'active' status.`);

    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
};

migrate();
