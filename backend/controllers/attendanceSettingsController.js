const asyncHandler = require("express-async-handler");
const DeductionRule = require("../models/DeductionRule");
const LeaveAllowance = require("../models/LeaveAllowance");
const AttendanceBalance = require("../models/AttendanceBalance");
const Employee = require("../models/Employee");
const { invalidateFeeRule } = require("../utils/feeOverdue");
const { invalidateFaceIndex } = require("../services/faceIndex");

const getMyBalance = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({ user: req.user._id }).select("_id");
  if (!employee) {
    res.status(404);
    throw new Error("Employee record not found for this user");
  }
  const balance = await AttendanceBalance.getOrCreateCurrentMonth(
    employee._id,
    req.user.company,
  );
  res.json({
    success: true,
    data: {
      lateUsed: balance.lateUsed,
      lateAllowed: balance.lateAllowed,
      leaveUsed: balance.leaveUsed,
    },
  });
});

const getAttendanceSettings = asyncHandler(async (req, res) => {
  const rule = await DeductionRule.findOne({ company: req.user.company });
  res.json({ success: true, data: rule || null });
});

const upsertAttendanceSettings = asyncHandler(async (req, res) => {
  const {
    shiftStartHour,
    shiftStartMinute,
    shiftEndHour,
    shiftEndMinute,
    lateThresholdMinutes,
    lateDeductionType,
    lateDeductionAmount,
    halfDayThresholdMinutes,
    earlyCheckoutThresholdMinutes,
    earlyCheckoutDeductionEnabled,
    feeLockEnabled,
    feeDueDay,
    feeGraceDays,
    studentFaceAttendanceEnabled,
    studentAttendanceTimeMode,
    studentAutoLateEnabled,
    studentLateGraceMinutes,
    studentAutoAbsentEnabled,
    studentAbsentAfterEndMinutes,
    paymentLinkEnabled,
    paymentLinkDay,
    paymentLinkHour,
  } = req.body;

  // Fee-lock fields are optional so older clients that don't send them
  // can't reset the owner's configuration.
  const feeLock = {};
  if (feeLockEnabled !== undefined) feeLock.feeLockEnabled = Boolean(feeLockEnabled);
  if (feeDueDay !== undefined)
    feeLock.feeDueDay = Math.min(28, Math.max(0, Math.floor(Number(feeDueDay) || 0)));
  if (feeGraceDays !== undefined)
    feeLock.feeGraceDays = Math.max(0, Math.floor(Number(feeGraceDays) || 0));

  const faceFlag =
    studentFaceAttendanceEnabled !== undefined
      ? { studentFaceAttendanceEnabled: Boolean(studentFaceAttendanceEnabled) }
      : {};

  const timeMode =
    studentAttendanceTimeMode === "single" ||
    studentAttendanceTimeMode === "in_out"
      ? { studentAttendanceTimeMode }
      : {};

  // Optional so older clients that don't send them can't reset the owner's
  // automatic late/absent configuration.
  const clampInt = (v, max) =>
    Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));
  const autoMarking = {};
  if (studentAutoLateEnabled !== undefined)
    autoMarking.studentAutoLateEnabled = Boolean(studentAutoLateEnabled);
  if (studentLateGraceMinutes !== undefined)
    autoMarking.studentLateGraceMinutes = clampInt(studentLateGraceMinutes, 240);
  if (studentAutoAbsentEnabled !== undefined)
    autoMarking.studentAutoAbsentEnabled = Boolean(studentAutoAbsentEnabled);
  if (studentAbsentAfterEndMinutes !== undefined)
    autoMarking.studentAbsentAfterEndMinutes = clampInt(
      studentAbsentAfterEndMinutes,
      720,
    );

  // Optional like the fields above: older clients can't reset the schedule.
  const paymentLink = {};
  if (paymentLinkEnabled !== undefined)
    paymentLink.paymentLinkEnabled = Boolean(paymentLinkEnabled);
  if (paymentLinkDay !== undefined)
    paymentLink.paymentLinkDay = Math.min(
      28,
      Math.max(1, Math.floor(Number(paymentLinkDay) || 1)),
    );
  if (paymentLinkHour !== undefined)
    paymentLink.paymentLinkHour = clampInt(paymentLinkHour, 23);

  const rule = await DeductionRule.findOneAndUpdate(
    { company: req.user.company },
    {
      $set: {
        company: req.user.company,
        shiftStartHour: Number(shiftStartHour) ?? 9,
        shiftStartMinute: Number(shiftStartMinute) ?? 0,
        shiftEndHour: Number(shiftEndHour) ?? 18,
        shiftEndMinute: Number(shiftEndMinute) ?? 0,
        lateThresholdMinutes: Number(lateThresholdMinutes) ?? 15,
        lateDeductionType: lateDeductionType || "fixed",
        lateDeductionAmount: Number(lateDeductionAmount) ?? 0,
        halfDayThresholdMinutes: Number(halfDayThresholdMinutes) ?? 120,
        earlyCheckoutThresholdMinutes:
          Number(earlyCheckoutThresholdMinutes) ?? 15,
        earlyCheckoutDeductionEnabled: Boolean(earlyCheckoutDeductionEnabled),
        ...feeLock,
        ...faceFlag,
        ...timeMode,
        ...autoMarking,
        ...paymentLink,
      },
    },
    { upsert: true, new: true },
  );
  invalidateFaceIndex();

  invalidateFeeRule(req.user.company);

  res.json({ success: true, data: rule });
});

// Readable by any logged-in user (coaches mark student attendance too).
const getStudentTimeMode = asyncHandler(async (req, res) => {
  const rule = await DeductionRule.findOne({
    company: req.user.company,
  }).select("studentAttendanceTimeMode");
  res.json({
    success: true,
    data: { mode: rule?.studentAttendanceTimeMode || "in_out" },
  });
});

const upsertLateAllowance = asyncHandler(async (req, res) => {
  const { mode, bulkCount, perEmployee } = req.body;

  const rule = await DeductionRule.findOneAndUpdate(
    { company: req.user.company },
    {
      $set: {
        company: req.user.company,
        "lateAllowance.mode": mode === "custom" ? "custom" : "bulk",
        "lateAllowance.bulkCount": Number(bulkCount) || 0,
        "lateAllowance.perEmployee": Array.isArray(perEmployee)
          ? perEmployee.map((p) => ({
              employee: p.employee,
              count: Number(p.count) || 0,
            }))
          : [],
      },
    },
    { upsert: true, new: true },
  );

  await AttendanceBalance.syncCurrentMonthLateAllowance(
    req.user.company,
    rule.lateAllowance,
  );

  res.json({ success: true, data: rule.lateAllowance });
});

const upsertLeaveAllowance = asyncHandler(async (req, res) => {
  const { leaveType, mode, bulkDays, perEmployee } = req.body;
  if (!leaveType) {
    res.status(400);
    throw new Error("leaveType is required");
  }

  const allowance = await LeaveAllowance.findOneAndUpdate(
    { company: req.user.company, leaveType },
    {
      $set: {
        company: req.user.company,
        leaveType,
        mode: mode === "custom" ? "custom" : "bulk",
        bulkDays: Number(bulkDays) || 0,
        perEmployee: Array.isArray(perEmployee)
          ? perEmployee.map((p) => ({
              employee: p.employee,
              days: Number(p.days) || 0,
            }))
          : [],
      },
    },
    { upsert: true, new: true },
  );

  await AttendanceBalance.syncCurrentMonthLeaveAllowance(
    req.user.company,
    leaveType,
    allowance,
  );

  res.json({ success: true, data: allowance });
});

const getBalanceSummary = asyncHandler(async (req, res) => {
  const employees = await Employee.find({
    company: req.user.company,
    status: { $ne: "terminated" },
  }).select("firstName lastName employeeId avatar");

  const summary = await Promise.all(
    employees.map(async (emp) => {
      const balance = await AttendanceBalance.getOrCreateCurrentMonth(
        emp._id,
        req.user.company,
      );
      return {
        employee: {
          _id: emp._id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          employeeId: emp.employeeId,
          avatar: emp.avatar,
        },
        lateUsed: balance.lateUsed,
        lateAllowed: balance.lateAllowed,
        leaveUsed: balance.leaveUsed,
      };
    }),
  );

  res.json({ success: true, data: summary });
});

module.exports = {
  getAttendanceSettings,
  upsertAttendanceSettings,
  upsertLateAllowance,
  upsertLeaveAllowance,
  getBalanceSummary,
  getMyBalance,
  getStudentTimeMode,
};
