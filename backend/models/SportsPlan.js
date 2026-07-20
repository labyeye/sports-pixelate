const mongoose = require("mongoose");

// A coaching plan the academy offers (e.g. "Tennis - 3x/week", "Swimming - Unlimited").
// Unlike the HRMS's own platform-wide Plan.js, these are defined per-academy (per company).
const sportsPlanSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    sport: { type: String, required: true },
    sessionsPerWeek: { type: Number, default: 0 }, // 0 = unlimited
    // How the plan's weekly schedule is defined:
    // - "unlimited": any day, no cap (sessionsPerWeek forced to 0)
    // - "sessions_per_week": a fixed count, day unspecified (legacy behavior)
    // - "custom_days": specific weekdays only — covers alternate-day clubs
    //   (e.g. Mon/Wed/Fri) where sessionsPerWeek is derived from scheduleDays.
    scheduleType: {
      type: String,
      enum: ["unlimited", "sessions_per_week", "custom_days"],
      default: "sessions_per_week",
    },
    scheduleDays: {
      type: [String],
      enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      default: [],
    },
    // Session clock time, e.g. "16:00" — "HH:mm" 24-hour strings so they sort
    // and compare as plain text without timezone handling.
    startTime: { type: String },
    endTime: { type: String },
    monthlyPrice: { type: Number, required: true },
    yearlyPrice: { type: Number, required: true },
    description: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SportsPlan", sportsPlanSchema);
