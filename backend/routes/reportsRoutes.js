const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getStudentFees,
  getOutstandingDues,
  getStudentPerformance,
  getStudentEnrollment,
  getBatchSummary,
  getSportSummary,
  getStudentProfile,
  getPaymentHistory,
  getIncomeReport,
  getTodayLedger,
} = require("../controllers/reportsController");

// Student related reports
router.get("/student-fees", protect, getStudentFees);
router.get("/student-outstanding", protect, getOutstandingDues);
router.get("/student-performance", protect, getStudentPerformance);
router.get("/student-enrollment", protect, getStudentEnrollment);
router.get("/batch-summary", protect, getBatchSummary);
router.get("/sport-summary", protect, getSportSummary);
router.get("/student-profile/:studentId", protect, getStudentProfile);

// Financial reports — owner/staff only, same restriction as Expenses.
router.get(
  "/payment-history",
  protect,
  authorize("super_admin", "hr_manager"),
  getPaymentHistory,
);
router.get(
  "/income",
  protect,
  authorize("super_admin", "hr_manager"),
  getIncomeReport,
);
router.get(
  "/today-ledger",
  protect,
  authorize("super_admin", "hr_manager"),
  getTodayLedger,
);

module.exports = router;
