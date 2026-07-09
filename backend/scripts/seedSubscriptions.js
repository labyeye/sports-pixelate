require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Subscription = require("../models/Subscription");
const Company = require("../models/Company");

connectDB();

const seedSubscriptions = async () => {
  try {
    console.log("🔄 Starting subscription seed...");

    await Subscription.deleteMany({});
    console.log("✅ Cleared existing subscriptions");

    const companies = await Company.find({});
    console.log(`📦 Found ${companies.length} companies`);

    const subscriptions = [];

    for (const company of companies) {
      const subscription = await Subscription.create({
        company: company._id,
        plan: "professional",
        monthlyPrice: 100,
        yearlyPrice: 1000,
        maxEmployees: 20,
        billingCycle: "monthly",
        currentEmployeeCount: 0,
        startDate: new Date(),
        renewalDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        status: "active",
        autoRenew: true,
        paymentStatus: "completed",
        paymentMethod: "razorpay",
        amountPaid: 100,
        notes: `Subscription created for ${company.name}`,
      });

      await Company.findByIdAndUpdate(company._id, {
        status: "active",
        subscription: subscription._id,
      });

      subscriptions.push(subscription);
      console.log(`✅ Created subscription for: ${company.name}`);
    }

    console.log(
      `\n✨ Seed complete! Created ${subscriptions.length} subscriptions`,
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding error:", error.message);
    process.exit(1);
  }
};

seedSubscriptions();
