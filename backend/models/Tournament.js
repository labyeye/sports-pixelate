const mongoose = require("mongoose");

// A team entered into the tournament — just a name for now (e.g. a batch,
// house, or visiting school), not tied to individual student rosters.
const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { _id: true },
);

// A student (via their parent, in the app) signing up to take part in the
// tournament. Independent of `teams` — this is who's playing, not bracket
// seeding, which staff still assemble manually.
const registrationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    registeredAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const tournamentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    sport: { type: String, required: true, trim: true },
    format: {
      type: String,
      enum: ["knockout", "round_robin"],
      default: "knockout",
    },
    startDate: { type: Date },
    endDate: { type: Date },
    venue: { type: String, trim: true },
    teams: [teamSchema],
    registrations: [registrationSchema],
    // Staff can close this once the roster is final; also auto-implied closed
    // once fixtures are generated.
    registrationOpen: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["draft", "upcoming", "ongoing", "completed"],
      default: "draft",
    },
    fixturesGenerated: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Tournament", tournamentSchema);
