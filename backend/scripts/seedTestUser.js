const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: "../.env" });

const User = require("../models/User");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");

async function seedTestUser() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/nesthr",
    );
    console.log("✅ Connected to MongoDB");

    const existingUser = await User.findOne({ email: "test@nesthr.com" });
    if (existingUser) {
      console.log("❌ Test user already exists");
      process.exit(0);
    }

    const user = await User.create({
      name: "Test User",
      email: "test@nesthr.com",
      password: "Test@12345",
      role: "hr_manager",
      phone: "+91 98765 43210",
      status: "active",
    });
    console.log("✅ User created:", user._id);

    const company = await Company.create({
      name: "Test Enterprise Inc.",
      email: "company@nesthr.com",
      phone: "+91 98765 43210",
      password: "CompanyPass@123",
      industry: "Technology",
      website: "https://testenterprise.com",
      gstNumber: "27AABCT1234A1Z5",
      panNumber: "AAAAA0000A",
      status: "active",
      createdBy: user._id,
    });
    console.log("✅ Company created:", company._id);

    const subscription = await Subscription.create({
      company: company._id,
      plan: "enterprise",
      monthlyPrice: 200,
      yearlyPrice: 1920,
      maxStudents: 50,
      billingCycle: "monthly",
      currentStudentCount: 0,
      startDate: new Date(),
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "active",
      autoRenew: true,
      paymentStatus: "completed",
      paymentMethod: "razorpay",
      amountPaid: 200,
      notes: "Test subscription for Enterprise plan",
    });
    console.log("✅ Subscription created:", subscription._id);

    await Company.findByIdAndUpdate(company._id, {
      subscription: subscription._id,
    });
    console.log("✅ Company updated with subscription");

    await User.findByIdAndUpdate(user._id, { company: company._id });
    console.log("✅ User updated with company");

    console.log("\n🎉 Test user seeded successfully!");
    console.log("\n📋 Test Credentials:");
    console.log("   Email: test@nesthr.com");
    console.log("   Password: Test@12345");
    console.log("   Plan: Enterprise (₹200/month)");
    console.log("   Max Employees: 50");
    console.log("   Status: Active (Payment Completed)");
    console.log("   WhatsApp Access: ✅ Available");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding test user:", error);
    process.exit(1);
  }
}

seedTestUser();
