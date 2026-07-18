const mongoose = require("mongoose");

const biometricLogSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    personType: {
      type: String,
      enum: ["employee", "student"],
      required: true,
    },
    personModel: {
      type: String,
      enum: ["Employee", "Student"],
      required: true,
    },
    person: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "personModel",
      required: true,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BiometricDevice",
      required: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BiometricLocation",
      required: true,
    },
    method: { type: String, enum: ["nfc", "face", "pin"], required: true },
    type: { type: String, enum: ["check_in", "check_out"], required: true },
    nfcUid: { type: String },
    attendanceModel: {
      type: String,
      enum: ["Attendance", "StudentAttendance"],
    },
    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "attendanceModel",
    },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BiometricLog", biometricLogSchema);
