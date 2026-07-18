const asyncHandler = require("express-async-handler");
const DeductionRule = require("../models/DeductionRule");
const LeaveAllowance = require("../models/LeaveAllowance");
const AttendanceBalance = require("../models/AttendanceBalance");
const Employee = require("../models/Employee");

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
  } = req.body;

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
      },
    },
    { upsert: true, new: true },
  );

  res.json({ success: true, data: rule });
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
};
