require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const PendingOrder = require("../models/PendingOrder");

async function run() {
  await connectDB();

  const [companies, subscriptions, pendingOrders] = await Promise.all([
    Company.find({}).lean(),
    Subscription.find({}).lean(),
    PendingOrder.find({}).lean(),
  ]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(__dirname, "../backups");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `pre-tier-update-${timestamp}.json`);

  fs.writeFileSync(
    outFile,
    JSON.stringify({ companies, subscriptions, pendingOrders }, null, 2),
  );

  console.log(
    `Backed up ${companies.length} companies, ${subscriptions.length} subscriptions, ${pendingOrders.length} pending orders`,
  );
  console.log(`-> ${outFile}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Backup failed:", err.message);
  process.exit(1);
});
