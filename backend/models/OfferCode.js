const mongoose = require("mongoose");

const usageSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    companyName: { type: String },
    userEmail: { type: String },
    invoiceNumber: { type: String },
    usedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const offerCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: { type: String, default: "" },
    bonusMonths: { type: Number, required: true, default: 2, min: 1 },
    maxUses: { type: Number, required: true, default: 200 },
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    createdByEmail: { type: String, default: "" },
    usages: [usageSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("OfferCode", offerCodeSchema);
