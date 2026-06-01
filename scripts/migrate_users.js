import "dotenv/config";
import mongoose from "mongoose";

const migrateUsers = async () => {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.MONGO_DB_NAME;

  if (!mongoUrl || !dbName) {
    throw new Error("Missing MONGO_URL or MONGO_DB_NAME in environment");
  }

  console.log(`Connecting to database: ${dbName}...`);
  await mongoose.connect(mongoUrl, { dbName });
  console.log("Connected to MongoDB.");

  const db = mongoose.connection.db;

  const customersCollection = db.collection("customers");
  const adminsCollection = db.collection("admins");
  const distributorsCollection = db.collection("distributors");
  const supportsCollection = db.collection("supports");

  // Read all users from the customers collection that are NOT 'customer' role
  const nonCustomerUsers = await customersCollection.find({ role: { $ne: "customer" } }).toArray();

  if (nonCustomerUsers.length === 0) {
    console.log("No users found in 'customers' collection that need to be migrated.");
  } else {
    console.log(`Found ${nonCustomerUsers.length} users to migrate. Moving them to respective collections...`);

    for (const user of nonCustomerUsers) {
      const role = user.role;
      
      if (role === "admin") {
        await adminsCollection.insertOne(user);
        console.log(`✅ Migrated admin: ${user.email} -> admins`);
      } else if (role === "distributor") {
        await distributorsCollection.insertOne(user);
        console.log(`✅ Migrated distributor: ${user.email} -> distributors`);
      } else if (role === "support") {
        await supportsCollection.insertOne(user);
        console.log(`✅ Migrated support: ${user.email} -> supports`);
      }

      // Remove from customers collection
      await customersCollection.deleteOne({ _id: user._id });
    }

    console.log("Migration completed successfully!");
  }

  await mongoose.connection.close();
  process.exit(0);
};

migrateUsers().catch(async (error) => {
  console.error("Migration failed:", error);
  await mongoose.connection.close();
  process.exit(1);
});
