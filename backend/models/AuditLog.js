const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userEmail: { type: String },
    userName: { type: String },
    action: { type: String, required: true },
    entity: { type: String },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: true },
);

auditLogSchema.index({ company: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
