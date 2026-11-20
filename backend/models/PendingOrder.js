const mongoose = require("mongoose");

// Staging record for a signup that hasn't paid yet. No Company/Subscription
// is created until the linked payment is verified — see billingController.
const pendingOrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    gateway: { type: String, enum: ["cashfree"], default: "cashfree" },
    // set for a renewal/upgrade of an existing academy (no new Company is created for it)
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    planId: { type: String, enum: ["starter", "growth", "unlimited"], required: true },
    maxStudents: { type: Number },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    companyName: { type: String },
    companyEmail: { type: String },
    companyPhone: { type: String },
    website: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },

    studentCount: { type: Number },
    employeeCount: { type: Number, default: 0 },
    wantsWhatsapp: { type: Boolean, default: false },
    billingCycle: { type: String, enum: ["monthly", "yearly"], default: "yearly" },
    ratePerUnit: { type: Number },
    monthlyPrice: { type: Number },
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
