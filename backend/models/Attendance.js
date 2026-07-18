const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    date: { type: Date, required: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    status: {
      type: String,
      enum: [
        "present",
        "absent",
        "half_day",
        "late",
        "on_leave",
        "holiday",
        "weekend",
      ],
      default: "absent",
    },
    workHours: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    earlyLeaving: { type: Boolean, default: false },
    notes: { type: String },
    leaveDeductSalary: { type: Boolean, default: true }, // for on_leave records: true = deduct, false = paid leave
    approvalPending: { type: Boolean, default: false }, // late beyond allowance, awaiting HR/Admin resolution via LateApproval
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifyMode: {
      type: String,
      enum: [
        "fingerprint",
        "card",
        "face",
        "password",
        "manual",
        "auto",
        "geo_camera",
      ],
      default: "manual",
    },
    checkInSelfie: { type: String },
    checkOutSelfie: { type: String },
    checkInLocation: {
      lat: { type: Number },
      lng: { type: Number },
      accuracy: { type: Number },
      distanceMeters: { type: Number },
    },
    checkOutLocation: {
      lat: { type: Number },
      lng: { type: Number },
      accuracy: { type: Number },
      distanceMeters: { type: Number },
    },
  },
  { timestamps: true },
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
