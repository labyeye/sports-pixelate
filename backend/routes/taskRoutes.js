const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createTask,
  getTasks,
  getTask,
  updateTask,
  updateTaskStatus,
  addComment,
  deleteTask,
} = require("../controllers/taskController");

const ASSIGN_ROLES = ["super_admin", "hr_manager", "department_head"];

router
  .route("/")
  .get(protect, getTasks)
  .post(protect, authorize(...ASSIGN_ROLES), createTask);

router.get("/:id", protect, getTask);
router.put("/:id", protect, authorize(...ASSIGN_ROLES), updateTask);
router.patch("/:id/status", protect, updateTaskStatus);
router.post("/:id/comments", protect, addComment);
router.delete("/:id", protect, authorize(...ASSIGN_ROLES), deleteTask);

module.exports = router;
