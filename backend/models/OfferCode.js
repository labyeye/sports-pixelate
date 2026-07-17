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

    // A code applies exactly one kind of discount:
    //  - bonus_months: extra free months tacked onto the renewal date
    //  - flat_rate:    overrides the per-student/year rate (e.g. 150 -> 100)
    //  - percent_off:  knocks a percentage off the computed yearly price
    discountType: {
      type: String,
      enum: ["bonus_months", "flat_rate", "percent_off"],
      required: true,
      default: "bonus_months",
    },
    bonusMonths: { type: Number, default: 0, min: 0 },
    flatRate: { type: Number, default: null, min: 1 },
    percentOff: { type: Number, default: null, min: 1, max: 100 },

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
