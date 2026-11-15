const express = require("express");
const c = require("../controllers/expenseClaimController");
const { protect, authorize } = require("../middleware/auth");
const { uploadExpenseBill } = require("../middleware/upload");
const router = express.Router();

router.get("/", protect, c.getExpenses);
router.post("/", protect, uploadExpenseBill, c.createExpense);
router.get("/workflow", protect, c.getWorkflow);
router.put(
  "/workflow",
  protect,
  authorize("super_admin", "hr_manager"),
  c.saveWorkflow,
);
router.get("/bill-file/:token", c.serveBillByToken);
router.get("/:id/bill-link/:index", protect, c.getBillLink);
router.get("/policy", protect, c.getPolicy);
router.put("/policy", protect, authorize("super_admin", "hr_manager"), c.savePolicy);
router.put("/:id", protect, uploadExpenseBill, c.updateExpense);
router.post("/:id/resubmit", protect, c.resubmitExpense);
router.put("/:id/pay", protect, authorize("super_admin", "hr_manager"), c.markPaid);
router.get("/:id/bill/:index", protect, c.downloadBill);
router.get("/:id/bill", protect, c.downloadBill);
router.put(
  "/:id/action",
  protect,
  authorize("super_admin", "hr_manager", "department_head"),
  c.actOnExpense,
);
router.delete("/:id", protect, c.deleteExpense);

module.exports = router;
