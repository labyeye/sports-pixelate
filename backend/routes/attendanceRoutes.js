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

router.get("/", protect, getAttendance);
router.get("/summary", protect, getMonthSummary);
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
