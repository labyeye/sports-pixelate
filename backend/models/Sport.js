const mongoose = require("mongoose");

// Canonical per-academy list of sports (e.g. "Tennis", "Swimming", "Football").
// Student.sport and Employee.sport (for coaches) store the same string values,
// picked from this list, so headcounts can be aggregated per sport.
const sportSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

sportSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Sport", sportSchema);
