const express = require("express");
const {
  getShifts,
  createShift,
  updateShift,
  deleteShift,
} = require("../controllers/shiftController");
const { protect } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getShifts);
router.post("/", protect, createShift);
router.put("/:id", protect, updateShift);
router.delete("/:id", protect, deleteShift);

module.exports = router;
