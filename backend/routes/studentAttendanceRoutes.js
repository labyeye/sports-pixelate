const express = require("express");
const {
  getStudentAttendance,
  markStudentAttendance,
  bulkMarkStudentAttendance,
} = require("../controllers/studentAttendanceController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getStudentAttendance);
router.post(
  "/",
  protect,
  authorize("super_admin", "hr_manager", "employee"),
  markStudentAttendance,
);
router.post(
  "/bulk",
  protect,
  authorize("super_admin", "hr_manager", "employee"),
  bulkMarkStudentAttendance,
);

module.exports = router;
