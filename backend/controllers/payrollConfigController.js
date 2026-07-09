const asyncHandler = require("express-async-handler");
const EmployeePayrollConfig = require("../models/EmployeePayrollConfig");
const DeductionRule = require("../models/DeductionRule");
const Employee = require("../models/Employee");

const getAllConfigs = asyncHandler(async (req, res) => {
  const configs = await EmployeePayrollConfig.find({
    company: req.user.company,
  })
    .populate({
      path: "employee",
      select: "firstName lastName employeeId designation department salary",
      populate: { path: "department", select: "name" },
    })
    .sort({ createdAt: -1 });
  res.json({ success: true, data: configs });
});

const getConfig = asyncHandler(async (req, res) => {
  const config = await EmployeePayrollConfig.findOne({
    employee: req.params.employeeId,
    company: req.user.company,
  });
  res.json({ success: true, data: config || null });
});

const upsertConfig = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const emp = await Employee.findOne({
    _id: employeeId,
    company: req.user.company,
  });
  if (!emp) {
    res.status(404);
    throw new Error("Employee not found");
  }

  const { basicSalary, hra, da, ta, medicalAllowance, otherAllowances } =
    req.body;

  const config = await EmployeePayrollConfig.findOneAndUpdate(
    { employee: employeeId, company: req.user.company },
    {
      $set: {
        company: req.user.company,
        employee: employeeId,
        basicSalary: Number(basicSalary) || 0,
        hra: Number(hra) || 0,
        da: Number(da) || 0,
        ta: Number(ta) || 0,
        medicalAllowance: Number(medicalAllowance) || 0,
        otherAllowances: Number(otherAllowances) || 0,
      },
    },
    { upsert: true, new: true },
  );

  await config.populate({
    path: "employee",
    select: "firstName lastName employeeId designation",
  });

  res.json({ success: true, data: config });
});

const getDeductionRules = asyncHandler(async (req, res) => {
  const rule = await DeductionRule.findOne({ company: req.user.company });
  res.json({ success: true, data: rule || null });
});

const upsertDeductionRules = asyncHandler(async (req, res) => {
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

module.exports = {
  getAllConfigs,
  getConfig,
  upsertConfig,
  getDeductionRules,
  upsertDeductionRules,
};
