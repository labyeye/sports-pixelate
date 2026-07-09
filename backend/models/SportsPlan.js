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
    monthlyPrice: { type: Number, required: true },
    yearlyPrice: { type: Number, required: true },
    description: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SportsPlan", sportsPlanSchema);
