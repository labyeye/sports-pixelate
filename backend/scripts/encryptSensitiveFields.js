// One-off migration: encrypts existing plaintext bank / PAN / Aadhaar / medical
// values in place. Safe to re-run (already-encrypted values are skipped), and
// the app reads both forms, so it can run while the app is live.
//
//   1. Back up the database first.
//   2. Set FIELD_ENCRYPTION_KEY (64 hex chars) in .env and never change it.
//   3. node scripts/encryptSensitiveFields.js          (dry run, counts only)
//      node scripts/encryptSensitiveFields.js --apply  (writes)
const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { encryptValue, isEncrypted } = require("../utils/fieldCrypto");

const TARGETS = [
  {
    collection: "employees",
    fields: ["bankAccount", "ifscCode", "panNumber", "aadharNumber"],
  },
  { collection: "students", fields: ["medicalNotes"] },
];
const apply = process.argv.includes("--apply");

(async () => {
  if (!process.env.FIELD_ENCRYPTION_KEY)
    console.warn(
      "WARNING: FIELD_ENCRYPTION_KEY is not set; a key is derived from JWT_SECRET.",
    );
  await mongoose.connect(process.env.MONGO_URI);
  for (const { collection, fields } of TARGETS) {
    const col = mongoose.connection.collection(collection);
    let touched = 0;
    const cursor = col.find({
      $or: fields.map((f) => ({ [f]: { $type: "string", $ne: "" } })),
    });
    for await (const doc of cursor) {
      const $set = {};
      for (const f of fields) {
        if (typeof doc[f] === "string" && doc[f] && !isEncrypted(doc[f]))
          $set[f] = encryptValue(doc[f]);
      }
      if (!Object.keys($set).length) continue;
      touched++;
      if (apply) await col.updateOne({ _id: doc._id }, { $set });
    }
    console.log(
      `${collection}: ${touched} document(s) ${apply ? "encrypted" : "to encrypt (dry run)"}`,
    );
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
