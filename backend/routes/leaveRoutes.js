const express = require("express");
const {
  getLeaves,
  createLeave,
  updateLeave,
  updateLeaveStatus,
  deleteLeave,
} = require("../controllers/leaveController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();
const NON_PARENT = [
  "super_admin",
  "hr_manager",
  "hr_executive",
  "department_head",
  "employee",
];

router
  .route("/")
  .get(protect, authorize(...NON_PARENT), getLeaves)
  .post(protect, authorize(...NON_PARENT), createLeave);
router
  .route("/:id")
  .patch(
    protect,
    authorize("employee", "super_admin", "admin", "hr_manager"),
    updateLeave,
  )
  .put(
    protect,
    authorize("super_admin", "admin", "hr_manager"),
    updateLeaveStatus,
  )
  .delete(protect, deleteLeave);

module.exports = router;
