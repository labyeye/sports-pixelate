const mongoose = require("mongoose");

const studentAttendanceSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ["present", "absent", "excused"],
      default: "absent",
    },
    batch: { type: String, default: "" }, // session label, e.g. "Morning U-12"
    notes: { type: String },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

studentAttendanceSchema.index({ student: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("StudentAttendance", studentAttendanceSchema);
