const mongoose = require("mongoose");

const STATUSES = [
  "new",
  "contacted",
  "trial_scheduled",
  "trial_done",
  "waitlisted",
  "converted",
  "lost",
];

// An admission enquiry: someone who has asked about joining but is not yet a
// Student. Converting a lead creates the Student and links it back here.
const leadSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    childName: { type: String, required: true, trim: true, maxlength: 120 },
    age: { type: Number, min: 0, max: 100 },
    guardianName: { type: String, trim: true, maxlength: 120, default: "" },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: "" },
    sport: { type: String, trim: true, default: "" },
    batch: { type: String, trim: true, default: "" },
    source: {
      type: String,
      enum: ["walk_in", "phone", "referral", "instagram", "facebook", "website", "hoarding", "other"],
      default: "walk_in",
    },
    status: { type: String, enum: STATUSES, default: "new", index: true },
    trialDate: { type: Date },
    followUpDate: { type: Date },
    lostReason: { type: String, trim: true, maxlength: 300, default: "" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    convertedAt: { type: Date },
    notes: [
      {
        text: { type: String, required: true, maxlength: 1000 },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

leadSchema.index({ company: 1, status: 1, followUpDate: 1 });

module.exports = mongoose.model("Lead", leadSchema);
module.exports.STATUSES = STATUSES;
