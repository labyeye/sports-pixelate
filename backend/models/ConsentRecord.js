const mongoose = require("mongoose");

// Who agreed to what, when, and which version of the text — the evidence
// behind the Terms / Privacy acceptance (and any later consent types such as
// biometric or photo consent).
const consentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    type: {
      type: String,
      enum: ["terms_privacy", "biometric", "photo", "communications"],
      required: true,
    },
    version: { type: String, required: true },
    grantedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true },
);

consentSchema.index({ user: 1, type: 1, grantedAt: -1 });

module.exports =
  mongoose.models.ConsentRecord ||
  mongoose.model("ConsentRecord", consentSchema);
