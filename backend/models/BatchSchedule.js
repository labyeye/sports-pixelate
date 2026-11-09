const mongoose = require("mongoose");

// Weekly timetable slot for a batch. Student.batch is a free-text string, so
// a slot is matched to students by (sport, batch) text equality.
const batchScheduleSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    sport: { type: String, required: true, trim: true },
    batch: { type: String, required: true, trim: true },
    days: {
      type: [Number], // 0 = Sunday … 6 = Saturday
      validate: (v) =>
        v.length > 0 && v.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    coach: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    venue: { type: String, trim: true, maxlength: 80 },
  },
  { timestamps: true },
);

batchScheduleSchema.index({ company: 1, sport: 1, batch: 1 });

module.exports = mongoose.model("BatchSchedule", batchScheduleSchema);
