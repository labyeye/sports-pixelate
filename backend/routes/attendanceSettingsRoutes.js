const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getAttendanceSettings,
  upsertAttendanceSettings,
  upsertLateAllowance,
  upsertLeaveAllowance,
  getBalanceSummary,
  getMyBalance,
} = require("../controllers/attendanceSettingsController");

router.get("/my-balance", protect, getMyBalance);

router.use(protect, authorize("super_admin", "hr_manager"));

router.get("/", getAttendanceSettings);
router.put("/", upsertAttendanceSettings);
router.put("/late-allowance", upsertLateAllowance);
router.put("/leave-allowance", upsertLeaveAllowance);
router.get("/balance-summary", getBalanceSummary);

module.exports = router;
