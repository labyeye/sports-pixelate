const mongoose = require("mongoose");

const stepSchema = new mongoose.Schema(
  {
    role: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    at: Date,
    note: { type: String, default: "" },
  },
  { _id: false },
);

const expenseSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: {
      type: String,
      enum: ["travel", "food", "fuel", "lodging", "internet_phone", "office", "other"],
      default: "other",
    },
    amount: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    notes: { type: String, default: "", maxlength: 500 },
    bill: { type: String, default: "" }, // legacy single bill (kept for old claims)
    bills: [{ type: String }], // filenames in uploads/expense-bills (authenticated download only), max 5
    // Kind-specific details (only the fields relevant to the category are stored)
    details: {
      from: { type: String, default: "", maxlength: 100 },
      to: { type: String, default: "", maxlength: 100 },
      distanceKm: { type: Number, min: 0 },
      fuelLitres: { type: Number, min: 0 },
      checkIn: Date,
      checkOut: Date,
      vendor: { type: String, default: "", maxlength: 100 },
    },
    // Amount actually approved (can be lower than claimed; payroll pays this)
    approvedAmount: { type: Number, min: 0 },
    policyExceeded: { type: Boolean, default: false },
    // Payment record, filled when the claim is settled
    payment: {
      mode: { type: String, enum: ["payroll", "bank_transfer", "upi", "cash", "cheque"] },
      paidOn: Date,
      reference: { type: String, default: "", maxlength: 100 },
      paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    resubmissionOf: { type: mongoose.Schema.Types.ObjectId, ref: "ExpenseClaim" },
    steps: [stepSchema],
    // draft: saved by employee, not submitted; pending: waiting on steps; approved: all steps done, queued for
    // payroll; paid: picked up by payroll / settled
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected", "paid"],
      default: "pending",
    },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
  },
  { timestamps: true },
);

expenseSchema.index({ company: 1, status: 1, date: -1 });

module.exports = mongoose.model("ExpenseClaim", expenseSchema);
