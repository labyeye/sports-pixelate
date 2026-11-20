const ConsentRecord = require("../models/ConsentRecord");
const terms = require("./terms");

// Verifiable parental consent for a child's data. The academy confirms at admission that a parent/guardian agreed
// to the Terms & Privacy Policy and to storing the child's photo, medical and attendance data.
const MESSAGE =
  "Please confirm that the parent/guardian has agreed to the Terms & Privacy Policy and to storing the child's data before adding a student.";

const given = (body) => body && body.guardianConsent === true;

/** Fields to store on a new Student. */
const consentFor = (req) => ({
  given: true,
  at: new Date(),
  by: req.user._id,
  version: terms.VERSION,
  guardianName: String(req.body?.guardianConsentName || "").slice(0, 120),
});

/** Evidence row (who recorded it, from where). */
const recordConsent = (req, student) =>
  ConsentRecord.create({
    user: req.user._id,
    recordedBy: req.user._id,
    student: student._id,
    company: req.user.company,
    type: "parental_consent",
    version: terms.VERSION,
    ip: String(req.ip || "").slice(0, 64),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 200),
  }).catch((e) => console.error("[Consent]", e.message));

module.exports = { MESSAGE, given, consentFor, recordConsent };
