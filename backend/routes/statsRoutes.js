const express = require("express");
const router = express.Router();
const { getPlatformStats } = require("../controllers/statsController");

// Simple secret-key guard — no JWT, but not wide-open either.
// Set CRM_API_SECRET in .env. Pass as ?key=<secret> or X-Stats-Key header.
function statsGuard(req, res, next) {
  const secret = process.env.CRM_API_SECRET;
  if (!secret) {
    return res.status(503).json({
      success: false,
      message: "Stats endpoint not configured (CRM_API_SECRET missing)",
    });
  }
  // Header is preferred (query strings end up in access logs); `?key=` is still
  // accepted so existing dashboards keep working.
  const provided = String(req.headers["x-stats-key"] || req.query.key || "");
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !require("crypto").timingSafeEqual(a, b)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
}

router.get("/", statsGuard, getPlatformStats);

module.exports = router;
