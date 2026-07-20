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

    whatsappEnabled: { type: Boolean, default: false },
    whatsappNotifyCheckIn: { type: Boolean, default: true },
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

module.exports = mongoose.model("Setting", settingSchema);
