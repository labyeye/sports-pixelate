const mongoose = require("mongoose");

// Tiny distributed lock so a scheduled job runs once per tick even when the
// API is deployed on several instances (and so "once per day" markers survive
// restarts). Documents expire on their own via the TTL index.
const jobLockSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  lockedUntil: { type: Date, required: true },
  expireAt: { type: Date, required: true },
});
jobLockSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("JobLock", jobLockSchema);
