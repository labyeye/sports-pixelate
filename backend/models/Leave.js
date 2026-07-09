const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
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
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    isHalfDay: { type: Boolean, default: false },
    halfDayType: { type: String, enum: ["first_half", "second_half"] },
    startHour: { type: String }, // e.g. "14:00"
    endHour: { type: String }, // e.g. "16:00"
    deductSalary: { type: Boolean, default: true }, // true = unpaid (deduct), false = paid leave (no deduction)
  },
  { timestamps: true },
);

module.exports = mongoose.model("Leave", leaveSchema);
