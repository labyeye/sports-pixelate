const mongoose = require("mongoose");

// A bookable resource — a court, pool lane, turf, or piece of equipment that
// can be reserved for a time slot.
const facilitySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["court", "pool", "turf", "gym", "equipment", "other"],
      default: "court",
    },
    sport: { type: String, default: "" },
    capacity: { type: Number, default: 1 },
    hourlyFee: { type: Number, default: 0 }, // 0 = free to book
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Facility", facilitySchema);
