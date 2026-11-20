const mongoose = require("mongoose");

// A replacement session for a class a student missed (illness, travel, rain
// cancellation). Matched to the timetable by free-text sport/batch like the
// rest of the student data.
const makeupClassSchema = new mongoose.Schema(
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
    sport: { type: String, trim: true, default: "" },
    batch: { type: String, trim: true, default: "" }, // batch the make-up is attended in
    missedDate: { type: Date }, // the class being made up
    scheduledDate: { type: Date, required: true },
    startTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    coach: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    status: {
      type: String,
      enum: ["scheduled", "completed", "missed", "cancelled"],
      default: "scheduled",
    },
    note: { type: String, trim: true, maxlength: 300, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

makeupClassSchema.index({ company: 1, scheduledDate: -1 });
makeupClassSchema.index({ company: 1, student: 1 });

module.exports = mongoose.model("MakeupClass", makeupClassSchema);
