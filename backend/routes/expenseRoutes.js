const express = require("express");
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} = require("../controllers/expenseController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

// Owner-only — expenses are financial records, staff/parents don't see them.
router
  .route("/")
  .get(protect, authorize("super_admin", "hr_manager"), getExpenses)
  .post(protect, authorize("super_admin", "hr_manager"), createExpense);

router
  .route("/:id")
  .put(protect, authorize("super_admin", "hr_manager"), updateExpense)
  .delete(protect, authorize("super_admin", "hr_manager"), deleteExpense);

module.exports = router;
