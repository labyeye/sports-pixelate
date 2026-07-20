const mongoose = require("mongoose");

// Read-only shell this pass — no QR check-in/attendance subsystem yet.
// Listing endpoint only; rows would be populated by a future attendance flow.
const eventAttendanceSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
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
    status: { type: String, enum: ["present", "absent"], default: "present" },
    markedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

eventAttendanceSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model("EventAttendance", eventAttendanceSchema);
