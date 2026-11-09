const mongoose = require("mongoose");

// A coach's skill assessment of one student: 1–5 score per skill + remarks.
const assessmentSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    assessedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    date: { type: Date, default: Date.now },
    level: { type: String, trim: true, maxlength: 40 }, // e.g. "Yellow belt", "Level 2"
    ratings: [
      {
        _id: false,
        skill: { type: String, required: true, trim: true, maxlength: 60 },
        score: { type: Number, required: true, min: 1, max: 5 },
      },
    ],
    remarks: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

assessmentSchema.index({ company: 1, student: 1, date: -1 });

module.exports = mongoose.model("Assessment", assessmentSchema);
