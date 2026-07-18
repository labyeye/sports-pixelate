const mongoose = require("mongoose");

// One entry per payment attempt (full or partial/installment) toward a
// subscription's `amount`. Every submission — first payment or a later
// top-up of the remaining balance — pushes a new entry here instead of
// overwriting a single scalar, so the parent's payment history is preserved.
const paymentAttemptSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    method: { type: String, enum: ["qr", "razorpay"], default: "qr" },
    utrNumber: { type: String },
    transactionNumber: { type: String },
    screenshot: { type: String },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    submittedAt: { type: Date, default: Date.now },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String },
  },
  { timestamps: true },
);

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
      enum: ["pending", "partial", "completed", "failed", "rejected"],
      default: "pending",
    },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    // Derived — sum of `payments[].amount` where status === "verified".
    // Stored (not virtual) so existing sort/filter/report queries on it
    // keep working; recomputed by the controller after every verify/reject.
    amountPaid: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "qr"],
      default: "razorpay",
    },
    payments: [paymentAttemptSchema],
    // Legacy single-payment fields — kept for old documents written before
    // the payments[] history existed. New code no longer writes to these.
    qrReferenceNumber: { type: String }, // UTR number the parent submits after paying the owner's QR
    transactionNumber: { type: String }, // separate bank/UPI transaction number the parent submits alongside the UTR
    paymentScreenshot: { type: String }, // proof-of-payment screenshot the parent uploads alongside the reference numbers
    qrSubmittedAt: { type: Date },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // owner/staff who verified a QR payment
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // owner/staff who marked a QR payment not verified
    rejectionReason: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "StudentSubscription",
  studentSubscriptionSchema,
);
