const mongoose = require("mongoose");

const studentSubscriptionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SportsPlan",
      required: true,
    },
    planName: { type: String, required: true }, // snapshot, in case the plan is edited/removed later
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },
    amount: { type: Number, required: true }, // snapshot of the price paid
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
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    amountPaid: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "qr"],
      default: "razorpay",
    },
    qrReferenceNumber: { type: String }, // UTR/UPI ref the parent submits after paying the owner's QR
    paymentScreenshot: { type: String }, // proof-of-payment screenshot the parent uploads alongside the reference number
    qrSubmittedAt: { type: Date },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // owner/staff who confirmed a QR payment
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "StudentSubscription",
  studentSubscriptionSchema,
);
