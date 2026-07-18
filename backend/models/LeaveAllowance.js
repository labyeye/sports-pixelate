const mongoose = require("mongoose");

const leaveAllowanceSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    leaveType: {
      type: String,
      enum: [
        "casual",
        "sick",
        "earned",
        "maternity",
        "paternity",
        "unpaid",
        "compensatory",
        "hourly",
        "wfh",
        "outdoor_duty",
      ],
      required: true,
    },
    mode: { type: String, enum: ["bulk", "custom"], default: "bulk" },
    bulkDays: { type: Number, default: 0 },
    perEmployee: [
      {
        employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
        days: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true },
);

leaveAllowanceSchema.index({ company: 1, leaveType: 1 }, { unique: true });

module.exports = mongoose.model("LeaveAllowance", leaveAllowanceSchema);
