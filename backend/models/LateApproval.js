const mongoose = require("mongoose");

const lateApprovalSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    date: { type: Date, required: true },
    checkInTime: { type: Date },
    minutesLate: { type: Number, default: 0 },
    reason: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    resolvedStatus: {
      type: String,
      enum: ["present", "late", "absent", "half_day"],
    },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("LateApproval", lateApprovalSchema);
