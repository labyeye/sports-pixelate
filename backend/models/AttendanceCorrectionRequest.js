const mongoose = require("mongoose");

const attendanceCorrectionRequestSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
    },
    date: { type: Date, required: true },
    type: {
      type: String,
      enum: ["regularization", "missed_punch"],
      required: true,
    },
    checkIn: { type: Date },
    checkOut: { type: Date },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "AttendanceCorrectionRequest",
  attendanceCorrectionRequestSchema
);
