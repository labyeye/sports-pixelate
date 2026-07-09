const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema(
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
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    basicSalary: { type: Number, required: true },
    hra: { type: Number, default: 0 },
    da: { type: Number, default: 0 },
    ta: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },
    grossSalary: { type: Number, required: true },
    pf: { type: Number, default: 0 },
    esi: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    loanDeduction: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    workingDays: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    leaveDays: { type: Number, default: 0 },
    totalWorkHours: { type: Number, default: 0 },
    hourlyRate: { type: Number, default: 0 },
    earnedBasic: { type: Number, default: 0 },
    otPay: { type: Number, default: 0 },
    lateDeductionAmount: { type: Number, default: 0 },
    halfDayDeduction: { type: Number, default: 0 },
    earlyCheckoutDeduction: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    absentDeduction: { type: Number, default: 0 },
    penaltyAmount: { type: Number, default: 0 },
    weeklyOffDays: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "processed", "paid"],
      default: "draft",
    },
    paidAt: { type: Date },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    remarks: { type: String },
    slipReceived: {
      type: String,
      enum: ["received", "not_received", null],
      default: null,
    },
    slipReceivedAt: { type: Date },
    slipReceivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    paymentMode: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque", "upi", null],
      default: null,
    },
  },
  { timestamps: true },
);

payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("Payroll", payrollSchema);
