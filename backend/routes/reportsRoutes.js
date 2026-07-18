const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getStudentFees,
  getOutstandingDues,
  getStudentPerformance,
  getStudentEnrollment,
  getBatchSummary,
  getSportSummary,
  getStudentProfile,
} = require("../controllers/reportsController");

// Student related reports
router.get("/student-fees", protect, getStudentFees);
router.get("/student-outstanding", protect, getOutstandingDues);
router.get("/student-performance", protect, getStudentPerformance);
router.get("/student-enrollment", protect, getStudentEnrollment);
router.get("/batch-summary", protect, getBatchSummary);
router.get("/sport-summary", protect, getSportSummary);
router.get("/student-profile/:studentId", protect, getStudentProfile);

module.exports = router;
