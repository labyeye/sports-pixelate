const express = require("express");
const {
  getStats,
  getEmployeeStats,
} = require("../controllers/dashboardController");
const { protect } = require("../middleware/auth");
const router = express.Router();

const noCache = (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
};

router.get("/stats", protect, noCache, getStats);
router.get("/employee", protect, noCache, getEmployeeStats);
module.exports = router;
