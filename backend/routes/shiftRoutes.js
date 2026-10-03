const express = require("express");
const {
  getShifts,
  createShift,
  updateShift,
  deleteShift,
} = require("../controllers/shiftController");
const { protect, authorize } = require("../middleware/auth");
const owner = authorize("super_admin", "hr_manager");
const router = express.Router();

router.get("/", protect, getShifts);
router.post("/", protect, owner, createShift);
router.put("/:id", protect, owner, updateShift);
router.delete("/:id", protect, owner, deleteShift);

module.exports = router;
