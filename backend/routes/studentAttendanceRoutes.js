const express = require("express");
const {
  getStudentAttendance,
  markStudentAttendance,
  bulkMarkStudentAttendance,
  markStudentAttendanceByFace,
} = require("../controllers/studentAttendanceController");
const { protect, authorize } = require("../middleware/auth");
const { uploadAttendanceSelfie } = require("../middleware/upload");
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
router.post(
  "/face-mark",
  protect,
  authorize("super_admin", "hr_manager", "employee"),
  uploadAttendanceSelfie,
  markStudentAttendanceByFace,
);

module.exports = router;
