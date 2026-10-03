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

// Aggregate reports cover every student in the academy, so they are owner/HR
// only. A single student's report card (below) is also open to that
// student's parents — the controller checks they are linked to the child.
const ownerOnly = authorize("super_admin", "hr_manager");
router.get("/student-fees", protect, ownerOnly, getStudentFees);
router.get("/student-outstanding", protect, ownerOnly, getOutstandingDues);
router.get("/student-performance", protect, ownerOnly, getStudentPerformance);
router.get("/student-enrollment", protect, ownerOnly, getStudentEnrollment);
router.get("/batch-summary", protect, ownerOnly, getBatchSummary);
router.get("/sport-summary", protect, ownerOnly, getSportSummary);
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
