const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} = require("../controllers/holidayController");

router.use(protect);

router.get("/", getHolidays);
router.post("/", authorize("super_admin", "hr_manager"), createHoliday);
router.put("/:id", authorize("super_admin", "hr_manager"), updateHoliday);
router.delete("/:id", authorize("super_admin", "hr_manager"), deleteHoliday);

module.exports = router;
