const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      unique: true,
      sparse: true,
    },
    companyName: {
      type: String,
      default: "",
    },
    companyGST: {
      type: String,
      default: "",
    },
    companyAddress: {
      type: String,
      default: "",
    },
    companyPhone: {
      type: String,
      default: "",
    },
    companyEmail: {
      type: String,
      default: "",
    },
    companyWebsite: {
      type: String,
      default: "",
    },
    companyPAN: {
      type: String,
      default: "",
    },
    logoUrl: {
      type: String,
      default: "",
    },
    // ID-card design (sizes, front/back elements). Validated by utils/idCardTemplate.js before it is saved.
    idCardTemplate: { type: mongoose.Schema.Types.Mixed, default: null },
    // Same shape, for the students' cards (fields: name, student ID, sport, batch, guardian, …).
    studentIdCardTemplate: { type: mongoose.Schema.Types.Mixed, default: null },
    // Student admission-form design (A4 pages). Validated by utils/admissionFormTemplate.js before it is saved.
    admissionFormTemplate: { type: mongoose.Schema.Types.Mixed, default: null },
    // % off for a 2nd+ child of the same family (shared guardian phone/parent login).
    siblingDiscountPercent: { type: Number, default: 0, min: 0, max: 50 },
    paymentQrUrl: {
      type: String,
      default: "",
    },
    chequeLogoX: { type: Number, default: 10 },
    chequeLogoY: { type: Number, default: 20 },
    chequeLogoW: { type: Number, default: 60 },
    chequeLogoH: { type: Number, default: 60 },
    payrollChequeTemplate: {
      type: String,
      default: "",
    },
    chequeTemplateDesign: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    bankAccountName: {
      type: String,
      default: "",
    },
    bankAccountNumber: {
      type: String,
      default: "",
    },
    bankIFSC: {
      type: String,
      default: "",
    },
    bankName: {
      type: String,
      default: "",
    },
    bankBranch: {
      type: String,
      default: "",
    },

    // The club's own payment gateway account — when credentials for the
    // selected gateway are set, student/booking payments are created
    // against this account (and land in the club's bank account) instead
    // of the platform's account. Cashfree is the default; "razorpay" is only kept so older academies still work.
    paymentGateway: {
      type: String,
      enum: ["cashfree", "phonepe", "paytm", "razorpay"],
      default: "cashfree",
    },
    razorpayKeyId: {
      type: String,
      default: "",
    },
    razorpayKeySecret: {
      type: String,
      default: "",
      select: false,
    },
    cashfreeAppId: {
      type: String,
      default: "",
    },
    cashfreeSecretKey: {
      type: String,
      default: "",
      select: false,
    },
    phonepeMerchantId: {
      type: String,
      default: "",
    },
    phonepeSaltKey: {
      type: String,
      default: "",
      select: false,
    },
    phonepeSaltIndex: {
      type: String,
      default: "1",
    },
    paytmMerchantId: {
      type: String,
      default: "",
    },
    paytmMerchantKey: {
      type: String,
      default: "",
      select: false,
    },

    whatsappEnabled: { type: Boolean, default: false },
    whatsappNotifyCheckIn: { type: Boolean, default: true },
    whatsappNotifyCelebrations: { type: Boolean, default: true }, // birthday + wedding anniversary wishes
    whatsappNotifyLeave: { type: Boolean, default: true },
    whatsappNotifyPayroll: { type: Boolean, default: true },
    whatsappNotifySubscription: { type: Boolean, default: true },
    whatsappSendPunchAlert: { type: String, default: "Both" },
    whatsappSendTxnAlert: { type: String, default: "Both" },
    whatsappSendLeaveAlert: { type: String, default: "Both" },
    whatsappConsolidated: { type: Boolean, default: false },
    whatsappLang: { type: String, default: "en" },

    salaryMode: {
      type: String,
      enum: ["monthly", "15day", "weekly"],
      default: "monthly",
    },
    salaryPayDay: { type: String, default: "31" },

    singlePunchAction: { type: String, default: "half_day" },
    doublePunchInterval: { type: Number, default: 5 },

    otEnabled: { type: Boolean, default: true },
    otRate: { type: Number, default: 0 },

    autoSalary: { type: Boolean, default: false },
    bioSync: { type: Boolean, default: true },
    smsEnabled: { type: Boolean, default: false },
    emailNotif: { type: Boolean, default: true },

    dashboardType: { type: String, default: "Normal" },
    timeFormat: { type: String, default: "12" },
    currency: { type: String, default: "INR" },
    state: { type: String, default: "Maharashtra" },
    empCodePrefix: { type: String, default: "" },
    empCodeSuffix: { type: String, default: "" },
    showCTC: { type: Boolean, default: false },
    branchwise: { type: Boolean, default: false },

    // Feature keys (see frontend/src/config/features.ts) the owner has
    // switched off; their screens are hidden from navigation.
    disabledFeatures: { type: [String], default: [] },

    essEnabled: { type: Boolean, default: true },
    essAllowPunch: { type: Boolean, default: false },
    essAllowSalarySlip: { type: Boolean, default: true },
    essAllowAttendance: { type: Boolean, default: true },
    essAllowLeave: { type: Boolean, default: true },
    essAllowPayHistory: { type: Boolean, default: true },
    essAllowWorkReport: { type: Boolean, default: false },
    essAllowAdvance: { type: Boolean, default: false },
    essAllowHoliday: { type: Boolean, default: true },
    essAllowMissPunch: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// The academy's own gateway secrets are stored encrypted (legacy plaintext still reads until re-saved).
require("../utils/fieldCrypto").fieldEncryption(settingSchema, [
  "razorpayKeySecret",
  "cashfreeSecretKey",
  "phonepeSaltKey",
  "paytmMerchantKey",
]);

module.exports = mongoose.model("Setting", settingSchema);
