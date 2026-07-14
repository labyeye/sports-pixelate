const asyncHandler = require("express-async-handler");
const Tournament = require("../models/Tournament");
const Fixture = require("../models/Fixture");
const { validateBody } = require("../middleware/validate");
const {
  roundRobinRounds,
  knockoutRounds,
  knockoutRoundLabel,
  toSlot,
} = require("../services/fixtureService");

const MAX_TEAMS = 64;

const createSchema = {
  name: { required: true, type: "string", minLength: 1, maxLength: 120 },
  sport: { required: true, type: "string", minLength: 1, maxLength: 60 },
  format: { enum: ["knockout", "round_robin"] },
};

function sanitizeTeams(input) {
  if (input === undefined) return [];
  if (!Array.isArray(input)) throw new Error("teams must be an array");
  if (input.length > MAX_TEAMS)
    throw new Error(`Cannot add more than ${MAX_TEAMS} teams`);
  return input.map((t, i) => {
    const name = typeof t === "string" ? t : t?.name;
    if (typeof name !== "string" || !name.trim() || name.length > 80)
      throw new Error(`teams[${i}] must have a valid name`);
    return { name: name.trim() };
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const getTournaments = asyncHandler(async (req, res) => {
  const tournaments = await Tournament.find({ company: req.user.company }).sort({
    createdAt: -1,
  });
  res.json({ success: true, data: tournaments });
});

const getTournament = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!tournament) {
    res.status(404);
    throw new Error("Tournament not found");
  }
  res.json({ success: true, data: tournament });
});

const createTournament = [
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const { name, sport, format, startDate, endDate, venue, teams } = req.body;
    let sanitizedTeams;
    try {
      sanitizedTeams = sanitizeTeams(teams);
    } catch (err) {
      res.status(400);
      throw err;
    }
    const tournament = await Tournament.create({
      company: req.user.company,
      name,
      sport,
      format: format || "knockout",
      startDate,
      endDate,
      venue,
      teams: sanitizedTeams,
    });
    res.status(201).json({ success: true, data: tournament });
  }),
];

const updateTournament = asyncHandler(async (req, res) => {
  const update = { ...req.body };
  delete update.teams; // teams are managed via the dedicated team endpoints
  delete update.fixturesGenerated;
  delete update.company; // tenant is fixed at creation, not client-editable
  delete update._id;
  const tournament = await Tournament.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    update,
    { new: true, runValidators: true },
  );
  if (!tournament) {
    res.status(404);
    throw new Error("Tournament not found");
  }
  res.json({ success: true, data: tournament });
});

const deleteTournament = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!tournament) {
    res.status(404);
    throw new Error("Tournament not found");
  }
  await Fixture.deleteMany({ tournament: tournament._id });
  res.json({ success: true, message: "Tournament deleted" });
});

const addTeam = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!tournament) {
    res.status(404);
    throw new Error("Tournament not found");
  }
  if (tournament.fixturesGenerated) {
    res.status(400);
    throw new Error("Cannot add teams after fixtures have been generated");
  }
  if (tournament.teams.length >= MAX_TEAMS) {
    res.status(400);
    throw new Error(`Cannot add more than ${MAX_TEAMS} teams`);
  }
  const name = req.body?.name;
  if (typeof name !== "string" || !name.trim() || name.length > 80) {
    res.status(400);
    throw new Error("A valid team name is required");
  }
  tournament.teams.push({ name: name.trim() });
  await tournament.save();
  res.status(201).json({ success: true, data: tournament });
});

const removeTeam = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!tournament) {
    res.status(404);
    throw new Error("Tournament not found");
  }
  if (tournament.fixturesGenerated) {
    res.status(400);
    throw new Error("Cannot remove teams after fixtures have been generated");
  }
  tournament.teams = tournament.teams.filter(
    (t) => t._id.toString() !== req.params.teamId,
  );
  await tournament.save();
  res.json({ success: true, data: tournament });
});

// Builds and persists the full fixture list for a tournament from its
// current team list. Knockout brackets are wired round-by-round so each
// fixture's `nextFixture` points at where its winner advances to; round-1
// byes (odd team counts padded to a power of two) are auto-resolved and
// their winner is propagated into round 2 immediately.
const generateFixtures = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!tournament) {
    res.status(404);
    throw new Error("Tournament not found");
  }
  if (tournament.teams.length < 2) {
    res.status(400);
    throw new Error("Add at least 2 teams before generating fixtures");
  }
  if (tournament.fixturesGenerated && !req.body?.regenerate) {
    res.status(400);
    throw new Error(
      "Fixtures already generated — pass regenerate:true to rebuild them",
    );
  }

  await Fixture.deleteMany({ tournament: tournament._id });

  const shouldShuffle = req.body?.shuffle !== false;
  const teamSlots = (shouldShuffle ? shuffle(tournament.teams) : tournament.teams).map(
    (t) => ({ team: t._id, name: t.name }),
  );

  if (tournament.format === "round_robin") {
    const rounds = roundRobinRounds(teamSlots);
    let matchIndex = 0;
    const docs = [];
    rounds.forEach((matches, roundIdx) => {
      matches.forEach((pair) => {
        docs.push({
          company: req.user.company,
          tournament: tournament._id,
          round: roundIdx + 1,
          roundLabel: `Round ${roundIdx + 1}`,
          matchIndex: matchIndex++,
          teamA: toSlot(pair[0]),
          teamB: toSlot(pair[1]),
          status: "scheduled",
        });
      });
    });
    if (docs.length) await Fixture.insertMany(docs);
  } else {
    const rounds = knockoutRounds(teamSlots);
    const totalRounds = rounds.length;
    let prevRoundDocs = null;

    for (let roundIdx = 0; roundIdx < totalRounds; roundIdx++) {
      const pairs = rounds[roundIdx];
      const roundLabel = knockoutRoundLabel(roundIdx, totalRounds);
      const docs = pairs.map((pair, matchIndex) => {
        const teamA = toSlot(pair[0]);
        const teamB = toSlot(pair[1]);
        const isBye = roundIdx === 0 && teamA.team && !teamB.team;
        return {
          company: req.user.company,
          tournament: tournament._id,
          round: roundIdx + 1,
          roundLabel,
          matchIndex,
          teamA,
          teamB,
          status: isBye ? "bye" : "scheduled",
          winner: isBye ? "A" : null,
        };
      });
      const created = docs.length ? await Fixture.insertMany(docs) : [];

      if (prevRoundDocs) {
        // Wire the previous round's winners forward into this round, and
        // propagate any round-1 byes straight through.
        for (let i = 0; i < prevRoundDocs.length; i++) {
          const prev = prevRoundDocs[i];
          const next = created[Math.floor(i / 2)];
          const slot = i % 2 === 0 ? "A" : "B";
          prev.nextFixture = next._id;
          prev.nextFixtureSlot = slot;
          await prev.save();

          if (prev.status === "bye") {
            const winnerSlot = prev.winner === "A" ? prev.teamA : prev.teamB;
            if (slot === "A") next.teamA = winnerSlot;
            else next.teamB = winnerSlot;
            await next.save();
          }
        }
      }
      prevRoundDocs = created;
    }
  }

  tournament.fixturesGenerated = true;
  if (tournament.status === "draft") tournament.status = "upcoming";
  await tournament.save();

  const fixtures = await Fixture.find({ tournament: tournament._id }).sort({
    round: 1,
    matchIndex: 1,
  });
  res.status(201).json({ success: true, data: fixtures });
});

const getFixtures = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!tournament) {
    res.status(404);
    throw new Error("Tournament not found");
  }
  const fixtures = await Fixture.find({ tournament: tournament._id }).sort({
    round: 1,
    matchIndex: 1,
  });
  res.json({ success: true, data: fixtures });
});

const recordResult = asyncHandler(async (req, res) => {
  const fixture = await Fixture.findOne({
    _id: req.params.fixtureId,
    company: req.user.company,
  });
  if (!fixture) {
    res.status(404);
    throw new Error("Fixture not found");
  }
  if (!fixture.teamA?.team || !fixture.teamB?.team) {
    res.status(400);
    throw new Error("Both teams must be set before recording a result");
  }
  const { scoreA, scoreB } = req.body;
  let { winner } = req.body;
  if (!winner && scoreA !== undefined && scoreB !== undefined) {
    if (Number(scoreA) === Number(scoreB)) {
      res.status(400);
      throw new Error("Scores are tied — winner must be specified explicitly");
    }
    winner = Number(scoreA) > Number(scoreB) ? "A" : "B";
  }
  if (!["A", "B"].includes(winner)) {
    res.status(400);
    throw new Error("winner must be 'A' or 'B'");
  }

  fixture.scoreA = scoreA !== undefined ? Number(scoreA) : fixture.scoreA;
  fixture.scoreB = scoreB !== undefined ? Number(scoreB) : fixture.scoreB;
  fixture.winner = winner;
  fixture.status = "completed";
  await fixture.save();

  if (fixture.nextFixture && fixture.nextFixtureSlot) {
    const next = await Fixture.findById(fixture.nextFixture);
    if (next) {
      const winnerSlot = winner === "A" ? fixture.teamA : fixture.teamB;
      if (fixture.nextFixtureSlot === "A") next.teamA = winnerSlot;
      else next.teamB = winnerSlot;
      await next.save();
    }
  }

  res.json({ success: true, data: fixture });
});

module.exports = {
  getTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  addTeam,
  removeTeam,
  generateFixtures,
  getFixtures,
  recordResult,
};
