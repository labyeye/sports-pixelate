const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const {
  getTrash,
  restoreTrash,
  purgeTrash,
} = require("../controllers/trashController");

const router = express.Router();
const ADMIN_ROLES = ["super_admin", "hr_manager"];

router.get("/", protect, authorize(...ADMIN_ROLES), getTrash);
router.post("/:id/restore", protect, authorize(...ADMIN_ROLES), restoreTrash);
router.delete("/:id", protect, authorize(...ADMIN_ROLES), purgeTrash);

module.exports = router;
