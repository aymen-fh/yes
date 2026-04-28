import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const peekSubscriptions = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      dbName: process.env.MONGO_DB_NAME,
    });
    const subscriptions = await mongoose.connection.db
      .collection("subscriptions")
      .find({})
      .limit(5)
      .toArray();
    console.log(JSON.stringify(subscriptions, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

peekSubscriptions();
