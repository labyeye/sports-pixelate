const asyncHandler = require("express-async-handler");
const Event = require("../models/Event");
const Fixture = require("../models/Fixture");
const Student = require("../models/Student");
const {
  validateBody,
  escapeRegex,
  safePagination,
  safeSort,
} = require("../middleware/validate");
const {
  roundRobinRounds,
  knockoutRounds,
  knockoutRoundLabel,
  toSlot,
  isFormatSupported,
} = require("../services/fixtureService");
const { getCategoryForActivity, getCategoryForEventType } = require("../config/eventTypeConfig");

const MAX_TEAMS = 64;
const EVENT_SORT_FIELDS = ["name", "startDate", "endDate", "createdAt"];

const createSchema = {
  name: { required: true, type: "string", minLength: 1, maxLength: 120 },
  eventType: { required: true, type: "string", minLength: 1, maxLength: 60 },
  activity: { required: true, type: "string", minLength: 1, maxLength: 60 },
  format: {
    enum: [
      "knockout",
      "round_robin",
      "single_elimination",
      "double_elimination",
      "league",
      "group_stage",
      "swiss",
      "best_of_series",
    ],
  },
  entryFee: { type: "number", min: 0, max: 1000000 },
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

// Resolves activityCategory server-side: prefer the event type's pinned
// category (e.g. tournament -> sports), otherwise look up the free-typed
// activity string against the registry (e.g. workshop + "Yoga" -> wellness).
function resolveActivityCategory(eventType, activity) {
  return getCategoryForEventType(eventType) || getCategoryForActivity(activity) || null;
}

// Trims an event's registrations down to the caller's own children when
// they're a parent, so one family never sees another's roster entries.
function scopeRegistrations(eventObj, user) {
  eventObj.registrationCount = eventObj.registrations.length;
  if (user.role === "parent") {
    const childIds = (user.children || []).map((c) => c.toString());
    eventObj.registrations = eventObj.registrations.filter((r) =>
      childIds.includes((r.student?._id || r.student)?.toString()),
    );
  }
  return eventObj;
}

const getEvents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { search, eventType, activity, status } = req.query;

  const filter = { company: req.user.company };
  if (eventType) filter.eventType = eventType;
  if (activity) filter.activity = activity;
  if (status) filter.status = status;
  if (search) {
    filter.name = { $regex: escapeRegex(search.slice(0, 100)), $options: "i" };
  }

  const sort = safeSort(req.query, EVENT_SORT_FIELDS, { createdAt: -1 });
  const total = await Event.countDocuments(filter);
  const events = await Event.find(filter)
    .populate("registrations.student", "firstName lastName sport avatar")
    .sort(sort)
    .skip(skip)
    .limit(limit);
  const data = events.map((e) => scopeRegistrations(e.toObject(), req.user));
  res.json({
    success: true,
    data,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const getEvent = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    _id: req.params.id,
    company: req.user.company,
  }).populate("registrations.student", "firstName lastName sport avatar");
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  res.json({ success: true, data: scopeRegistrations(event.toObject(), req.user) });
});

const createEvent = [
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const {
      name,
      eventType,
      activity,
      format,
      startDate,
      endDate,
      entryFee,
      teams,
      description,
      organizerName,
      contactPerson,
      mobileNumber,
      email,
      website,
      schedule,
      venue,
      participation,
      categories,
      fees,
      awards,
      automation,
      sportFields,
      danceFields,
      workshopFields,
      performanceFields,
      visibility,
    } = req.body;
    let sanitizedTeams;
    try {
      sanitizedTeams = sanitizeTeams(teams);
    } catch (err) {
      res.status(400);
      throw err;
    }
    const event = await Event.create({
      company: req.user.company,
      name,
      eventType,
      activity,
      activityCategory: resolveActivityCategory(eventType, activity),
      format: format || "knockout",
      startDate,
      endDate,
      entryFee: entryFee !== undefined ? Number(entryFee) : 0,
      teams: sanitizedTeams,
      description,
      organizerName,
      contactPerson,
      mobileNumber,
      email,
      website,
      schedule,
      venue,
      participation,
      categories,
      fees,
      awards,
      automation,
      sportFields,
      danceFields,
      workshopFields,
      performanceFields,
      visibility,
    });
    res.status(201).json({ success: true, data: event });
  }),
];

const updateEvent = asyncHandler(async (req, res) => {
  const update = { ...req.body };
  delete update.teams; // teams are managed via the dedicated team endpoints
  delete update.registrations; // registrations are managed via the dedicated registration endpoints
  delete update.officials; // officials are managed via the dedicated official endpoints
  delete update.documents; // documents are managed via the dedicated document endpoints
  delete update.fixturesGenerated;
  delete update.coverImageUrl; // images are managed via the dedicated image endpoint
  delete update.bannerImageUrl;
  delete update.company; // tenant is fixed at creation, not client-editable
  delete update._id;

  if (update.eventType || update.activity) {
    const existing = await Event.findOne({ _id: req.params.id, company: req.user.company });
    if (existing) {
      update.activityCategory = resolveActivityCategory(
        update.eventType || existing.eventType,
        update.activity || existing.activity,
      );
    }
  }

  const event = await Event.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    update,
    { new: true, runValidators: true },
  );
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  res.json({ success: true, data: event });
});

const deleteEvent = asyncHandler(async (req, res) => {
  const event = await Event.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  await Fixture.deleteMany({ event: event._id });
  res.json({ success: true, message: "Event deleted" });
});

// Overview tab KPI summary. `computed` fields are explicitly flagged real vs
// placeholder so the frontend can render "—" for anything not backed by
// a real subsystem yet (Payments/Attendance/Certificates are shells).
const getEventDashboard = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  const totalRegistrations = event.registrations.length;
  const totalParticipants =
    event.participation?.type === "team" ? event.teams.length : event.registrations.length;

  let upcomingSessions = 0;
  let completedSessions = 0;
  if (event.fixturesGenerated) {
    upcomingSessions = await Fixture.countDocuments({ event: event._id, status: "scheduled" });
    completedSessions = await Fixture.countDocuments({ event: event._id, status: "completed" });
  }

  res.json({
    success: true,
    data: {
      totalRegistrations,
      totalParticipants,
      upcomingSessions,
      completedSessions,
      revenue: totalRegistrations * (event.fees?.entryFee || event.entryFee || 0),
      pendingPayments: 0, // placeholder — Payments is a shell tab this pass
      certificatesIssued: 0, // placeholder — no certificate subsystem yet
      attendancePercent: null, // placeholder — Attendance is a shell tab this pass
    },
  });
});

const updateEventImages = asyncHandler(async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const update = {};
  if (req.files?.coverImage?.[0]) {
    update.coverImageUrl = `${baseUrl}/uploads/event-covers/${req.files.coverImage[0].filename}`;
  }
  if (req.files?.bannerImage?.[0]) {
    update.bannerImageUrl = `${baseUrl}/uploads/event-banners/${req.files.bannerImage[0].filename}`;
  }
  if (!Object.keys(update).length) {
    res.status(400);
    throw new Error("No image uploaded");
  }
  const event = await Event.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    update,
    { new: true },
  );
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  res.json({ success: true, data: event });
});

const addTeam = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  if (event.fixturesGenerated) {
    res.status(400);
    throw new Error("Cannot add teams after fixtures have been generated");
  }
  if (event.teams.length >= MAX_TEAMS) {
    res.status(400);
    throw new Error(`Cannot add more than ${MAX_TEAMS} teams`);
  }
  const name = req.body?.name;
  if (typeof name !== "string" || !name.trim() || name.length > 80) {
    res.status(400);
    throw new Error("A valid team name is required");
  }
  event.teams.push({ name: name.trim() });
  await event.save();
  res.status(201).json({ success: true, data: event });
});

const removeTeam = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  if (event.fixturesGenerated) {
    res.status(400);
    throw new Error("Cannot remove teams after fixtures have been generated");
  }
  event.teams = event.teams.filter((t) => t._id.toString() !== req.params.teamId);
  await event.save();
  res.json({ success: true, data: event });
});

// Parent (or owner/staff enrolling a walk-in) signs a student up to take
// part in the event — same ownership rule as subscriptionController.createOrder.
const registerStudent = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }

  const { studentId } = req.body;
  if (!studentId) {
    res.status(400);
    throw new Error("studentId is required");
  }
  if (
    req.user.role === "parent" &&
    !(req.user.children || []).some((c) => c.toString() === studentId)
  ) {
    res.status(403);
    throw new Error("You can only register your own child");
  }

  const student = await Student.findOne({ _id: studentId, company: req.user.company });
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }
  // Only sports events require a student's enrolled sport to match the
  // event's activity — a dance/workshop/other event shouldn't gate on it.
  if (event.activityCategory === "sports" && student.sport !== event.activity) {
    res.status(400);
    throw new Error(
      `This is a ${event.activity} event — ${student.firstName} is enrolled in ${student.sport}`,
    );
  }
  if (!event.registrationOpen || event.fixturesGenerated) {
    res.status(400);
    throw new Error("Registration is closed for this event");
  }
  if (event.registrations.some((r) => r.student.toString() === studentId)) {
    res.status(400);
    throw new Error(`${student.firstName} is already registered`);
  }

  event.registrations.push({ student: student._id });
  await event.save();

  const populated = await Event.findById(event._id).populate(
    "registrations.student",
    "firstName lastName sport avatar",
  );
  res.status(201).json({
    success: true,
    data: scopeRegistrations(populated.toObject(), req.user),
  });
});

const unregisterStudent = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  const { studentId } = req.params;
  if (
    req.user.role === "parent" &&
    !(req.user.children || []).some((c) => c.toString() === studentId)
  ) {
    res.status(403);
    throw new Error("You can only unregister your own child");
  }

  event.registrations = event.registrations.filter((r) => r.student.toString() !== studentId);
  await event.save();

  const populated = await Event.findById(event._id).populate(
    "registrations.student",
    "firstName lastName sport avatar",
  );
  res.json({ success: true, data: scopeRegistrations(populated.toObject(), req.user) });
});

// Builds and persists the full fixture list for an event from its current
// team list. Knockout brackets are wired round-by-round so each fixture's
// `nextFixture` points at where its winner advances to; round-1 byes (odd
// team counts padded to a power of two) are auto-resolved and their winner
// is propagated into round 2 immediately.
const generateFixtures = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  if (!isFormatSupported(event.format)) {
    res.status(400);
    throw new Error(
      `Fixture generation for "${event.format}" is coming soon — currently supported: Knockout, Round Robin`,
    );
  }
  if (event.teams.length < 2) {
    res.status(400);
    throw new Error("Add at least 2 teams before generating fixtures");
  }
  if (event.fixturesGenerated && !req.body?.regenerate) {
    res.status(400);
    throw new Error("Fixtures already generated — pass regenerate:true to rebuild them");
  }

  await Fixture.deleteMany({ event: event._id });

  const shouldShuffle = req.body?.shuffle !== false;
  const teamSlots = (shouldShuffle ? shuffle(event.teams) : event.teams).map((t) => ({
    team: t._id,
    name: t.name,
  }));

  if (event.format === "round_robin") {
    const rounds = roundRobinRounds(teamSlots);
    let matchIndex = 0;
    const docs = [];
    rounds.forEach((matches, roundIdx) => {
      matches.forEach((pair) => {
        docs.push({
          company: req.user.company,
          event: event._id,
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
          event: event._id,
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

  event.fixturesGenerated = true;
  if (event.status === "draft") event.status = "upcoming";
  await event.save();

  const fixtures = await Fixture.find({ event: event._id }).sort({ round: 1, matchIndex: 1 });
  res.status(201).json({ success: true, data: fixtures });
});

const getFixtures = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  const fixtures = await Fixture.find({ event: event._id }).sort({ round: 1, matchIndex: 1 });
  res.json({ success: true, data: fixtures });
});

// Auto-flip an event's status to "completed" once every fixture has a
// result, only when the event opted into automation.autoPublishResults.
async function maybeAutoCompleteEvent(event) {
  if (!event.automation?.autoPublishResults) return;
  const outstanding = await Fixture.countDocuments({
    event: event._id,
    status: { $ne: "completed" },
  });
  if (outstanding === 0 && event.status !== "completed") {
    event.status = "completed";
    await event.save();
  }
}

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

  const event = await Event.findById(fixture.event);
  if (event) await maybeAutoCompleteEvent(event);

  res.json({ success: true, data: fixture });
});

const addOfficial = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  const { name, role, phone, email } = req.body;
  if (typeof name !== "string" || !name.trim()) {
    res.status(400);
    throw new Error("A valid name is required");
  }
  event.officials.push({ name: name.trim(), role, phone, email });
  await event.save();
  res.status(201).json({ success: true, data: event });
});

const updateOfficial = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  const official = event.officials.id(req.params.officialId);
  if (!official) {
    res.status(404);
    throw new Error("Official not found");
  }
  ["name", "role", "phone", "email"].forEach((f) => {
    if (req.body[f] !== undefined) official[f] = req.body[f];
  });
  await event.save();
  res.json({ success: true, data: event });
});

const removeOfficial = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  event.officials = event.officials.filter((o) => o._id.toString() !== req.params.officialId);
  await event.save();
  res.json({ success: true, data: event });
});

const addDocument = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }
  const { kind, label } = req.body;
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  event.documents.push({
    kind: kind || "other",
    label,
    url: `${baseUrl}/uploads/event-documents/${req.file.filename}`,
  });
  await event.save();
  res.status(201).json({ success: true, data: event });
});

const removeDocument = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  event.documents = event.documents.filter((d) => d._id.toString() !== req.params.docId);
  await event.save();
  res.json({ success: true, data: event });
});

module.exports = {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventDashboard,
  updateEventImages,
  addTeam,
  removeTeam,
  registerStudent,
  unregisterStudent,
  generateFixtures,
  getFixtures,
  recordResult,
  addOfficial,
  updateOfficial,
  removeOfficial,
  addDocument,
  removeDocument,
};
