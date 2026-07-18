// One-off, idempotent data backfill for the Tournament -> Event schema
// generalization. Not required to boot the app (Event.js schema defaults
// fill gaps for old documents on read), but fills in sensible values for
// fields that are new so the UI shows correct data before anyone edits an
// old event manually.
//
// Run manually: node backend/scripts/migrateTournamentsToEvents.js
// Safe to re-run — only touches documents missing `eventType`.

require("dotenv").config();
const mongoose = require("mongoose");
const Event = require("../models/Event");

const STATUS_MAP = {
  draft: "draft",
  upcoming: "upcoming",
  ongoing: "live",
  completed: "completed",
};

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected. Scanning for legacy tournament documents...");

  // Use the raw driver collection (not the Mongoose model) so fields no
  // longer declared on the Event schema (e.g. the old `sport` string) are
  // still readable off the stored document during this one-off backfill.
  const raw = Event.collection;
  const legacyDocs = await raw.find({ eventType: { $exists: false } }).toArray();
  console.log(`Found ${legacyDocs.length} documents to migrate.`);

  let migrated = 0;
  for (const doc of legacyDocs) {
    const set = {
      eventType: "tournament",
      activity: doc.sport || doc.activity || "General",
      activityCategory: "sports",
      venueLegacy: doc.venueLegacy || doc.venue || "",
      schedule: { ...(doc.schedule || {}), eventDate: doc.schedule?.eventDate || doc.startDate || null },
      participation: doc.participation || { type: "team" },
      fees: { ...(doc.fees || {}), entryFee: doc.fees?.entryFee ?? doc.entryFee ?? 0 },
      awards: doc.awards || {},
      automation: doc.automation || {},
      categories: doc.categories || {},
      visibility: doc.visibility || "public",
      status: STATUS_MAP[doc.status] || doc.status || "draft",
    };

    await raw.updateOne({ _id: doc._id }, { $set: set });
    migrated++;
  }

  console.log(`Migrated ${migrated} documents.`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
