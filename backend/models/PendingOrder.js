const mongoose = require("mongoose");

// Staging record for a signup that hasn't paid yet. No Company/Subscription
// is created until the linked payment is verified — see billingController.
const pendingOrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    gateway: { type: String, enum: ["razorpay", "hdfc"], required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    companyName: { type: String, required: true },
    companyEmail: { type: String, required: true },
    companyPhone: { type: String, required: true },
    website: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },

    studentCount: { type: Number, required: true },
    employeeCount: { type: Number, default: 0 },
    wantsWhatsapp: { type: Boolean, default: false },
    billingCycle: { type: String, enum: ["monthly", "yearly"], required: true },
    ratePerUnit: { type: Number, required: true },
    monthlyPrice: { type: Number, required: true },
    yearlyPrice: { type: Number, required: true },
    // GST breakdown for the amount actually billed (matches billingCycle).
    gstRate: { type: Number, default: 18 },
    subtotal: { type: Number },
    gstAmount: { type: Number },

    offerCode: { type: String, default: null },
    offerBonusMonths: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Abandoned/unpaid pending orders auto-expire after 24h.
pendingOrderSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 },
);

module.exports = mongoose.model("PendingOrder", pendingOrderSchema);
