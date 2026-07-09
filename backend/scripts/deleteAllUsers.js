require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

const deleteAllUsers = async () => {
  try {
    await connectDB();
    const result = await User.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} users from the database`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error deleting users:", error.message);
    process.exit(1);
  }
};

deleteAllUsers();
