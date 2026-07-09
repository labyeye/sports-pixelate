const AuditLog = require("../models/AuditLog");

async function logAudit(req, action, entity, entityId, details = {}) {
  try {
    await AuditLog.create({
      company: req.user?.company,
      user: req.user?._id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      action,
      entity,
      entityId,
      details,
      ip: req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
    });
  } catch {
    // audit logging must never crash the main flow
  }
}

module.exports = { logAudit };
