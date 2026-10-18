const express = require("express");
const router = express.Router();
const { getPlatformStats } = require("../controllers/statsController");

// Simple secret-key guard — no JWT, but not wide-open either.
// Set CRM_API_SECRET in .env. Pass as X-Stats-Key header.
function statsGuard(req, res, next) {
  const secret = process.env.CRM_API_SECRET;
  if (!secret) {
    return res.status(503).json({
      success: false,
      message: "Stats endpoint not configured (CRM_API_SECRET missing)",
    });
  }
  // Header only: query strings end up in access logs and browser history.
  const provided = String(req.headers["x-stats-key"] || "");
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !require("crypto").timingSafeEqual(a, b)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
}

router.get("/", statsGuard, getPlatformStats);

module.exports = router;
