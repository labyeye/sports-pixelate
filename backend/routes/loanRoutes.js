const express = require("express");
const {
  getLoans,
  createLoan,
  requestLoan,
  updateLoanStatus,
  updateLoan,
  deleteLoan,
  bulkImportLoans,
} = require("../controllers/loanController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

const owner = authorize("super_admin", "hr_manager");

// Anyone can see their own loans and request one; only the owner/HR can
// create, approve, edit, delete or import loans.
router.get("/", protect, getLoans);
router.post("/request", protect, requestLoan);
router.post("/", protect, owner, createLoan);
router.post("/bulk-import", protect, owner, bulkImportLoans);
router.put("/:id/status", protect, owner, updateLoanStatus);
router.put("/:id", protect, owner, updateLoan);
router.delete("/:id", protect, owner, deleteLoan);

module.exports = router;
