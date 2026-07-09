const express = require("express");
const {
  getItems,
  createItem,
  updateItem,
  deleteItem,
  recordTransaction,
  assignItem,
  returnAssignment,
} = require("../controllers/inventoryController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

const ownerOrStaff = authorize("super_admin", "hr_manager", "employee");

router
  .route("/")
  .get(protect, ownerOrStaff, getItems)
  .post(protect, authorize("super_admin", "hr_manager"), createItem);

router
  .route("/:id")
  .put(protect, authorize("super_admin", "hr_manager"), updateItem)
  .delete(protect, authorize("super_admin", "hr_manager"), deleteItem);

router.post("/:id/transactions", protect, ownerOrStaff, recordTransaction);
router.post("/:id/assign", protect, ownerOrStaff, assignItem);
router.post("/:id/assignments/:assignmentId/return", protect, ownerOrStaff, returnAssignment);

module.exports = router;
