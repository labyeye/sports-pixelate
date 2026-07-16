require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Subscription = require("../models/Subscription");

const SUBSCRIPTION_ID = "6a2d15b297508e20189ae029";
const TIER = "whatsapp";

async function run() {
  await connectDB();

  const before =
    await Subscription.findById(SUBSCRIPTION_ID).select("company plan tier");
  if (!before) {
    console.error(`Subscription ${SUBSCRIPTION_ID} not found`);
    process.exit(1);
  }
  console.log("Before:", before.toObject());

  const updated = await Subscription.findByIdAndUpdate(
    SUBSCRIPTION_ID,
    { tier: TIER },
    { new: true },
  ).select("company plan tier");
  console.log("After:", updated.toObject());

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Update failed:", err.message);
  process.exit(1);
});
