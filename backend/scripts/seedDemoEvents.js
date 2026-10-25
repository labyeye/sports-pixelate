// Adds three demo events to the academy of a given account (default labh@gmail.com).
// Idempotent: events are matched by name, so re-running does not duplicate them.
//   node scripts/seedDemoEvents.js [email]
const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const User = require("../models/User");
const Event = require("../models/Event");

const email = process.argv[2] || "labh@gmail.com";

function inDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

const demo = (company) => [
  {
    company,
    name: "Inter-Academy Football Cup 2026",
    eventType: "tournament",
    activity: "Football",
    description:
      "Knockout football tournament for U-14 and U-16 teams from academies across the city.",
    organizerName: "Labh Bothra",
    status: "registration_open",
    visibility: "public",
    format: "knockout",
    startDate: inDays(21),
    endDate: inDays(22),
    entryFee: 1500,
    registrationOpen: true,
    schedule: {
      eventDate: inDays(21),
      startTime: "08:00",
      endTime: "17:00",
      registrationOpensAt: inDays(-5),
      registrationClosesAt: inDays(14),
    },
    venue: {
      name: "City Sports Ground",
      city: "Mumbai",
      state: "Maharashtra",
      indoorOutdoor: "outdoor",
    },
    participation: { type: "team", maxRegistrations: 16, waitingListEnabled: true },
    fees: { entryFee: 1500, currency: "INR" },
    awards: {
      winnerPrize: "Trophy + ₹25,000",
      runnerUpPrize: "Trophy + ₹10,000",
      medals: true,
      trophies: true,
      participationCertificate: true,
    },
    teams: [
      { name: "Under-14 Blue" },
      { name: "Under-14 Red" },
      { name: "Under-16 Eagles" },
      { name: "Under-16 Lions" },
    ],
  },
  {
    company,
    name: "Badminton Skills Workshop",
    eventType: "workshop",
    activity: "Badminton",
    description:
      "One-day workshop on footwork, smash technique and match strategy with a national-level coach.",
    organizerName: "Labh Bothra",
    status: "upcoming",
    visibility: "public",
    startDate: inDays(9),
    endDate: inDays(9),
    entryFee: 500,
    schedule: { eventDate: inDays(9), startTime: "10:00", endTime: "15:00" },
    venue: {
      name: "Indoor Badminton Hall",
      city: "Mumbai",
      state: "Maharashtra",
      indoorOutdoor: "indoor",
    },
    participation: { type: "individual", maxRegistrations: 40 },
    fees: { entryFee: 500, currency: "INR" },
    workshopFields: {
      instructor: "Coach Rohan Mehta",
      maxSeats: 40,
      sessionDurationMinutes: 300,
      certificateAvailable: true,
    },
  },
  {
    company,
    name: "Summer Sports Camp",
    eventType: "camp",
    activity: "Multi-sport",
    description:
      "A week-long summer camp covering cricket, swimming, athletics and fitness for ages 8 to 15.",
    organizerName: "Labh Bothra",
    status: "registration_open",
    visibility: "public",
    startDate: inDays(35),
    endDate: inDays(41),
    entryFee: 4500,
    registrationOpen: true,
    schedule: {
      eventDate: inDays(35),
      startTime: "07:00",
      endTime: "12:00",
      registrationOpensAt: inDays(-2),
      registrationClosesAt: inDays(30),
    },
    venue: {
      name: "Academy Campus",
      city: "Mumbai",
      state: "Maharashtra",
      indoorOutdoor: "outdoor",
    },
    participation: { type: "individual", maxRegistrations: 60 },
    fees: { entryFee: 4500, currency: "INR" },
    workshopFields: {
      instructor: "Academy coaching staff",
      maxSeats: 60,
      sessionDurationMinutes: 300,
      certificateAvailable: true,
    },
  },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email }).select("company");
  if (!user?.company) throw new Error(`No academy found for ${email}`);
  for (const ev of demo(user.company)) {
    const exists = await Event.findOne({ company: user.company, name: ev.name });
    if (exists) {
      console.log("skip (exists):", ev.name);
      continue;
    }
    await Event.create(ev);
    console.log("created:", ev.name);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
