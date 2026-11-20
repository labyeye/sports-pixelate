const express = require("express");
const {
  studentInsights,
  planInsights,
  expenseInsights,
  studentAttendanceInsights,
} = require("../controllers/insightsController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

// Aggregated numbers behind the page-level graphs; owners and managers only.
const owner = authorize("super_admin", "hr_manager");
router.get("/students", protect, owner, studentInsights);
router.get("/plans", protect, owner, planInsights);
router.get("/expenses", protect, owner, expenseInsights);
router.get("/student-attendance", protect, owner, studentAttendanceInsights);
module.exports = router;
