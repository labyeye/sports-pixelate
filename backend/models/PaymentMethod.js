const mongoose = require("mongoose");
const crypto = require("crypto");

const paymentMethodSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["card", "upi", "bank_transfer"],
      required: true,
    },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    cardNumber: { type: String },
    cardholderName: { type: String },
    expiryMonth: { type: Number },
    expiryYear: { type: Number },
    cardBrand: { type: String },

    upiId: { type: String },

    accountHolderName: { type: String },
    accountNumber: { type: String },
    bankName: { type: String },
    ifscCode: { type: String },

    razorpayTokenId: { type: String },

    lastUsed: { type: Date },
    failureCount: { type: Number, default: 0 },
    notes: { type: String },
  },
  { timestamps: true },
);

paymentMethodSchema.index({ company: 1, isDefault: 1 });

module.exports = mongoose.model("PaymentMethod", paymentMethodSchema);
