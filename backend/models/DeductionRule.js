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

    // Fee lock: when enabled, student attendance is refused for students whose
    // subscription fee is overdue by more than `feeGraceDays`.
    // feeDueDay 1-28 = fee due on that day of the month; 0 = use the
    // subscription's own renewal date as the due date.
    feeLockEnabled: { type: Boolean, default: false },
    feeDueDay: { type: Number, default: 0, min: 0, max: 28 },
    feeGraceDays: { type: Number, default: 7, min: 0 },

    // Owner opt-in: when on, the face kiosk and coach face check-in recognise
    // and mark students (employees are unaffected). Off by default.
    studentFaceAttendanceEnabled: { type: Boolean, default: false },

    // Student attendance time capture: "in_out" records check-in and
    // check-out; "single" records one time (stored as checkIn).
    studentAttendanceTimeMode: {
      type: String,
      enum: ["in_out", "single"],
      default: "in_out",
    },

    // Owner-controlled automatic student marking. Both off by default, in
    // which case only manual present/absent/etc. marks are ever recorded.
    // Auto-late: a "present" mark more than `studentLateGraceMinutes` after the
    // session start time is recorded as "late".
    studentAutoLateEnabled: { type: Boolean, default: false },
    studentLateGraceMinutes: { type: Number, default: 15, min: 0, max: 240 },
    // Auto-absent: scheduled students still unmarked `studentAbsentAfterEndMinutes`
    // after their session ends are marked "absent".
    studentAutoAbsentEnabled: { type: Boolean, default: false },
    studentAbsentAfterEndMinutes: { type: Number, default: 30, min: 0, max: 720 },

    // Monthly fee payment link: on `paymentLinkDay` of each month (at
    // `paymentLinkHour` IST) every student with a fee due gets a WhatsApp link
    // to pay online. Off by default.
    paymentLinkEnabled: { type: Boolean, default: false },
    paymentLinkDay: { type: Number, default: 1, min: 1, max: 28 },
    paymentLinkHour: { type: Number, default: 9, min: 0, max: 23 },

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
