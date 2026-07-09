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

router.route("/").get(protect, getLeaves).post(protect, createLeave);
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
