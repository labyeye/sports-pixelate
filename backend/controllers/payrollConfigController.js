const asyncHandler = require("express-async-handler");
const EmployeePayrollConfig = require("../models/EmployeePayrollConfig");
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

module.exports = {
  getAllConfigs,
  getConfig,
  upsertConfig,
};
