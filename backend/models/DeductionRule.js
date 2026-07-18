const mongoose = require("mongoose");

const deductionRuleSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
    },

    shiftStartHour: { type: Number, default: 9 },
    shiftStartMinute: { type: Number, default: 0 },

    shiftEndHour: { type: Number, default: 18 },
    shiftEndMinute: { type: Number, default: 0 },

    lateThresholdMinutes: { type: Number, default: 15 },
    lateDeductionType: {
      type: String,
      enum: ["fixed", "percent"],
      default: "fixed",
    },
    lateDeductionAmount: { type: Number, default: 0 },

    halfDayThresholdMinutes: { type: Number, default: 120 },

    earlyCheckoutThresholdMinutes: { type: Number, default: 15 },
    earlyCheckoutDeductionEnabled: { type: Boolean, default: false },

    lateAllowance: {
      mode: { type: String, enum: ["bulk", "custom"], default: "bulk" },
      bulkCount: { type: Number, default: 0 },
      perEmployee: [
        {
          employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
          count: { type: Number, default: 0 },
        },
      ],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("DeductionRule", deductionRuleSchema);
