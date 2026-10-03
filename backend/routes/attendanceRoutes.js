const express = require("express");
const {
  getAttendance,
  markAttendance,
  selfMarkAttendance,
  updateAttendance,
  bulkMarkAttendance,
  getMonthSummary,
} = require("../controllers/attendanceController");
const { runAutoMark } = require("../jobs/attendanceAutoMark");
const { protect, authorize } = require("../middleware/auth");
const { uploadAttendanceSelfie } = require("../middleware/upload");
const router = express.Router();
const NON_PARENT = [
  "super_admin",
  "hr_manager",
  "hr_executive",
  "department_head",
  "employee",
];

router.get("/", protect, authorize(...NON_PARENT), getAttendance);
router.get("/summary", protect, authorize(...NON_PARENT), getMonthSummary);
router.post("/self-mark", protect, uploadAttendanceSelfie, selfMarkAttendance);
router.post(
  "/",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  markAttendance,
);
router.put(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  updateAttendance,
);
router.post(
  "/bulk",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  bulkMarkAttendance,
);

router.post(
  "/auto-mark",
  protect,
  authorize("super_admin", "hr_manager"),
  async (req, res) => {
    await runAutoMark();
    res.json({ success: true, message: "Auto-mark job completed" });
  },
);

module.exports = router;
