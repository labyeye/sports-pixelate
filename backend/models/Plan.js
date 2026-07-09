const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: ["Starter", "Professional", "Enterprise"],
    },
    planType: {
      type: String,
      required: true,
      enum: ["starter", "professional", "enterprise"],
    },
    monthlyPrice: { type: Number, required: true },
    yearlyPrice: { type: Number, required: true },
    maxEmployees: { type: Number, required: true },
    features: [{ type: String }],
    description: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Plan", planSchema);
