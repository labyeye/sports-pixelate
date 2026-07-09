const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
    invoiceNumber: { type: String, required: true, unique: true },
    plan: { type: String, required: true },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["paid", "pending", "failed"],
      default: "paid",
    },
    paidAt: { type: Date },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    hdfcOrderId: { type: String },
    hdfcTrackingId: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Invoice", invoiceSchema);
