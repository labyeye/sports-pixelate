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
const { protect } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getLoans);
router.post("/", protect, createLoan);
router.post("/bulk-import", protect, bulkImportLoans);
router.post("/request", protect, requestLoan);
router.put("/:id/status", protect, updateLoanStatus);
router.put("/:id", protect, updateLoan);
router.delete("/:id", protect, deleteLoan);

module.exports = router;
