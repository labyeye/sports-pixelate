const mongoose = require("mongoose");

// A team slot on a fixture — denormalized (id + name) so the bracket reads
// without populating Tournament.teams on every request. `team` is null for
// a knockout slot still waiting on a previous round's winner.
const slotSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, default: null },
    name: { type: String, default: null },
  },
  { _id: false },
);

const fixtureSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
      required: true,
    },
    round: { type: Number, required: true }, // 1-based
    roundLabel: { type: String, required: true }, // "Round 1", "Semifinal", "Final", "Round Robin"
    matchIndex: { type: Number, required: true }, // position within the round
    teamA: slotSchema,
    teamB: slotSchema,
    scoreA: { type: Number },
    scoreB: { type: Number },
    winner: { type: String, enum: ["A", "B"], default: null },
    status: {
      type: String,
      enum: ["scheduled", "completed", "bye"],
      default: "scheduled",
    },
    date: { type: Date },
    venue: { type: String, trim: true },
    // Knockout bracket progression — where this match's winner goes next.
    nextFixture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fixture",
      default: null,
    },
    nextFixtureSlot: { type: String, enum: ["A", "B"], default: null },
  },
  { timestamps: true },
);

fixtureSchema.index({ tournament: 1, round: 1, matchIndex: 1 });

module.exports = mongoose.model("Fixture", fixtureSchema);
