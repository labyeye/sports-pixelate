const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    plan: { type: String, required: true },
    studentCount: { type: Number },
    employeeCount: { type: Number, default: 0 },
    wantsWhatsapp: { type: Boolean, default: false },
    ratePerUnit: { type: Number },
    monthlyPrice: { type: Number, required: true },
    yearlyPrice: { type: Number, required: true },
    maxStudents: { type: Number, required: true },
    maxEmployees: { type: Number, default: 0 },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },
    currentStudentCount: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    renewalDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "inactive", "cancelled", "pending_renewal"],
      default: "active",
    },
    autoRenew: { type: Boolean, default: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    paymentMethod: { type: String },
    amountPaid: { type: Number, default: 0 },
    notes: { type: String },
    isTrial: { type: Boolean, default: false },
    trialEndDate: { type: Date },
    hdfcOrderId: { type: String, index: true },
    hdfcTrackingId: { type: String },
    hdfcBankRefNo: { type: String },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    offerCode: { type: String, default: null },
    offerBonusMonths: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
