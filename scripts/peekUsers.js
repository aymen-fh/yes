import mongoose from "mongoose";
import dotenv from "dotenv";
import CustomerModel from "../src/modules/customers/customer.model.js";

dotenv.config();

const peek = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      dbName: process.env.MONGO_DB_NAME,
    });
    const customers = await CustomerModel.find({}, {
      password: 0,
      refreshTokenHash: 0,
    }).limit(5);
    console.log(JSON.stringify(customers, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

peek();
