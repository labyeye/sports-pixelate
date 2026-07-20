const mongoose = require("mongoose");

// A participant entered into the event — just a name for now (e.g. a batch,
// house, or visiting school), not tied to individual student rosters. Used
// when participation.type === "team".
const participantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { _id: true },
);

// A student (via their parent, in the app) signing up to take part in the
// event. Independent of `teams` — this is who's playing, not bracket
// seeding, which staff still assemble manually. `team` optionally links a
// registration to a `teams[]._id` when participation.type === "team".
const registrationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    team: { type: mongoose.Schema.Types.ObjectId, default: null },
    registeredAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["confirmed", "waitlisted"],
      default: "confirmed",
    },
  },
  { _id: true },
);

const venueSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    hallGroundCourtStage: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    mapsUrl: { type: String, trim: true },
    indoorOutdoor: {
      type: String,
      enum: ["indoor", "outdoor", null],
      default: null,
    },
  },
  { _id: false },
);

const scheduleSchema = new mongoose.Schema(
  {
    registrationOpensAt: { type: Date, default: null },
    registrationClosesAt: { type: Date, default: null },
    eventDate: { type: Date, default: null },
    startTime: { type: String, trim: true },
    endTime: { type: String, trim: true },
    checkInTime: { type: String, trim: true },
    openingCeremonyTime: { type: String, trim: true },
    closingCeremonyTime: { type: String, trim: true },
  },
  { _id: false },
);

const participationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["individual", "team", "group"],
      default: "team",
    },
    maxRegistrations: { type: Number, default: null, min: 0 },
    minParticipants: { type: Number, default: null, min: 0 },
    maxParticipants: { type: Number, default: null, min: 0 },
    waitingListEnabled: { type: Boolean, default: false },
    onlineRegistration: { type: Boolean, default: true },
    approvalRequired: { type: Boolean, default: false },
  },
  { _id: false },
);

const categoriesSchema = new mongoose.Schema(
  {
    ageCategory: [{ type: String, trim: true }],
    gender: [{ type: String, trim: true }],
    skillLevel: [{ type: String, trim: true }],
    division: [{ type: String, trim: true }],
  },
  { _id: false },
);

const feesSchema = new mongoose.Schema(
  {
    entryFee: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "INR", trim: true },
    earlyBirdDiscount: { type: Number, default: 0, min: 0 },
    earlyBirdDeadline: { type: Date, default: null },
    lateRegistrationFee: { type: Number, default: 0, min: 0 },
    registrationDeadline: { type: Date, default: null },
    onlinePaymentEnabled: { type: Boolean, default: false },
  },
  { _id: false },
);

const awardsSchema = new mongoose.Schema(
  {
    winnerPrize: { type: String, trim: true },
    runnerUpPrize: { type: String, trim: true },
    participationCertificate: { type: Boolean, default: false },
    cashPrize: { type: Number, default: 0, min: 0 },
    medals: { type: Boolean, default: false },
    trophies: { type: Boolean, default: false },
    specialAwards: [{ type: String, trim: true }],
    description: { type: String, trim: true },
  },
  { _id: false },
);

const officialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
  },
  { _id: true },
);

const documentSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: [
        "rule_book",
        "guidelines",
        "consent_form",
        "medical_form",
        "performance_music",
        "fixture_pdf",
        "other",
      ],
      required: true,
    },
    label: { type: String, trim: true },
    url: { type: String, required: true, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const automationSchema = new mongoose.Schema(
  {
    // FUNCTIONAL toggles — gate real behavior in the controller.
    notifications: { type: Boolean, default: true },
    onlinePayments: { type: Boolean, default: false },
    autoPublishResults: { type: Boolean, default: false },
    // Stored-but-inert this pass — no Attendance/Certificates/Live-updates
    // subsystem exists yet (Payments/Attendance tabs are shells).
    qrCheckIn: { type: Boolean, default: false },
    attendanceTracking: { type: Boolean, default: false },
    liveUpdates: { type: Boolean, default: false },
    certificates: { type: Boolean, default: false },
  },
  { _id: false },
);

// Rendered/validated only when activityCategory === "sports". `format` is
// NOT duplicated here — the sport-specific UI reads/writes the top-level
// `format` field directly so there is a single source of truth for it.
const sportFieldsSchema = new mongoose.Schema(
  {
    maxTeams: { type: Number, default: 64, min: 2, max: 128 },
    groupsEnabled: { type: Boolean, default: false },
    matchDurationMinutes: { type: Number, default: null },
    extraTimeAllowed: { type: Boolean, default: false },
    penaltyRules: { type: String, trim: true },
    tieBreakRules: { type: String, trim: true },
    playerLimit: { type: Number, default: null },
    substitutesAllowed: { type: Number, default: null },
    seedingEnabled: { type: Boolean, default: false },
    randomDraw: { type: Boolean, default: true },
  },
  { _id: false },
);

const danceFieldsSchema = new mongoose.Schema(
  {
    danceStyle: { type: String, trim: true },
    performanceMode: {
      type: String,
      enum: ["solo", "duo", "group", null],
      default: null,
    },
    performanceDurationMinutes: { type: Number, default: null },
    musicUploadUrl: { type: String, trim: true },
    theme: { type: String, trim: true },
    propsAllowed: { type: Boolean, default: true },
    costumeGuidelines: { type: String, trim: true },
    judgingCriteria: [{ type: String, trim: true }],
    performanceOrder: { type: Number, default: null },
    stageDimensions: { type: String, trim: true },
    maxPerformers: { type: Number, default: null },
    minPerformers: { type: Number, default: null },
  },
  { _id: false },
);

const workshopFieldsSchema = new mongoose.Schema(
  {
    instructor: { type: String, trim: true },
    maxSeats: { type: Number, default: null },
    sessionDurationMinutes: { type: Number, default: null },
    materialsRequired: { type: String, trim: true },
    certificateAvailable: { type: Boolean, default: false },
  },
  { _id: false },
);

const performanceFieldsSchema = new mongoose.Schema(
  {
    performanceOrder: { type: Number, default: null },
    greenRoomRequired: { type: Boolean, default: false },
    soundCheckTime: { type: String, trim: true },
    lightingNotes: { type: String, trim: true },
    stageManager: { type: String, trim: true },
  },
  { _id: false },
);

const eventSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    // Basics
    name: { type: String, required: true, trim: true },
    // Free string keyed into config/eventTypeConfig.js — not a hard Mongoose
    // enum, so new event types (incl. "custom") never need a migration.
    eventType: {
      type: String,
      required: true,
      trim: true,
      default: "tournament",
    },
    activity: { type: String, required: true, trim: true }, // was `sport`, generalized
    // Denormalized cache of the eventTypeConfig category lookup, set
    // server-side on save so queries/UI don't need to re-derive it.
    activityCategory: { type: String, trim: true, default: null },
    coverImageUrl: { type: String, trim: true, default: null },
    bannerImageUrl: { type: String, trim: true, default: null },
    description: { type: String, trim: true },
    organizerName: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    mobileNumber: { type: String, trim: true },
    email: { type: String, trim: true },
    website: { type: String, trim: true },

    schedule: { type: scheduleSchema, default: () => ({}) },
    venue: { type: venueSchema, default: () => ({}) },
    participation: { type: participationSchema, default: () => ({}) },
    categories: { type: categoriesSchema, default: () => ({}) },
    fees: { type: feesSchema, default: () => ({}) },
    awards: { type: awardsSchema, default: () => ({}) },
    officials: [officialSchema],
    documents: [documentSchema],
    automation: { type: automationSchema, default: () => ({}) },

    sportFields: { type: sportFieldsSchema, default: () => ({}) },
    danceFields: { type: danceFieldsSchema, default: () => ({}) },
    workshopFields: { type: workshopFieldsSchema, default: () => ({}) },
    performanceFields: { type: performanceFieldsSchema, default: () => ({}) },

    // --- Legacy fields, kept so existing Tournament documents remain valid
    // and because generateFixtures/Fixture cascade logic reads them
    // directly. New structured `venue` object above wins in the UI; old
    // string venue moves to `venueLegacy`.
    format: {
      type: String,
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
      default: "knockout",
    },
    startDate: { type: Date },
    endDate: { type: Date },
    venueLegacy: { type: String, trim: true },
    entryFee: { type: Number, default: 0, min: 0 },
    teams: [participantSchema],
    registrations: [registrationSchema],
    registrationOpen: { type: Boolean, default: true },
    fixturesGenerated: { type: Boolean, default: false },

    status: {
      type: String,
      enum: [
        "draft",
        "registration_open",
        "registration_closed",
        "upcoming",
        "live",
        "completed",
        "cancelled",
      ],
      default: "draft",
    },
    visibility: {
      type: String,
      enum: ["public", "private", "invite_only"],
      default: "public",
    },
  },
  { timestamps: true },
);

eventSchema.index({ company: 1, status: 1 });
eventSchema.index({ company: 1, eventType: 1 });

// 3rd arg pins the Mongo collection name to the existing "tournaments"
// collection so old Tournament documents keep working in place — no data
// copy/rename needed for this model swap.
module.exports = mongoose.model("Event", eventSchema, "tournaments");
