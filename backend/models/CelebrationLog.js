const mongoose = require("mongoose");

// One row per wish actually sent: the unique index makes the daily job safe to re-run (once per person, kind and year).
const schema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, required: true },
    ref: { type: String, required: true }, // employee / student id
    kind: { type: String, enum: ["birthday", "anniversary"], required: true },
    year: { type: Number, required: true },
  },
  { timestamps: true },
);
schema.index({ company: 1, ref: 1, kind: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("CelebrationLog", schema);
