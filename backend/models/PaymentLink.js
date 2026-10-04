const mongoose = require("mongoose");

// One WhatsApp payment link per student subscription per month. The public
// /pay/:token page uses `token` as its only credential, so it is random,
// unguessable and expires.
const paymentLinkSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentSubscription",
      required: true,
    },
    token: { type: String, required: true, unique: true },
    // "YYYY-MM" (IST) the link was issued for — with `subscription` makes the
    // monthly send idempotent.
    month: { type: String, required: true },
    // "balance" = unpaid amount on the current plan period;
    // "renewal" = the next period's fee once the plan is due.
    type: { type: String, enum: ["balance", "renewal"], required: true },
    amount: { type: Number, required: true },
    planName: { type: String, required: true },
    guardianName: { type: String },
    guardianPhone: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "expired"],
      default: "pending",
    },
    expiresAt: { type: Date, required: true },
    paidAt: { type: Date },
    // Gateway order for the in-progress payment attempt.
    gateway: { type: String },
    orderId: { type: String },
    // WhatsApp delivery bookkeeping.
    sentAt: { type: Date },
    sendAttempts: { type: Number, default: 0 },
    lastError: { type: String },
  },
  { timestamps: true },
);

paymentLinkSchema.index({ subscription: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("PaymentLink", paymentLinkSchema);
