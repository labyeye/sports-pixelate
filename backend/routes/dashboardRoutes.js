const express = require("express");
const {
  getStats,
  getEmployeeStats,
} = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

const noCache = (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
};

// Company-wide numbers (payroll, revenue …) — managers only. Employees and
// parents use /employee and their own portals.
router.get(
  "/stats",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive", "department_head"),
  noCache,
  getStats,
);
router.get("/employee", protect, noCache, getEmployeeStats);
module.exports = router;
