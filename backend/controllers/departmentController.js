const asyncHandler = require("express-async-handler");
const Department = require("../models/Department");
const Employee = require("../models/Employee");

const getDepartments = asyncHandler(async (req, res) => {
  const departments = await Department.find({
    company: req.user.company,
    status: "active",
  })
    .populate("head", "name email")
    .sort({ name: 1 });

  const withCounts = await Promise.all(
    departments.map(async (d) => {
      const count = await Employee.countDocuments({
        company: req.user.company,
        department: d._id,
        status: "active",
      });
      return { ...d.toObject(), headcount: count };
    }),
  );

  res.json({ success: true, data: withCounts });
});

const createDepartment = asyncHandler(async (req, res) => {
  const { name, code, head, description, budget } = req.body;

  if (
    !name ||
    typeof name !== "string" ||
    name.trim().length < 1 ||
    name.trim().length > 100
  ) {
    res.status(400);
    throw new Error("Department name is required (max 100 chars)");
  }
  if (
    !code ||
    typeof code !== "string" ||
    code.trim().length < 1 ||
    code.trim().length > 20
  ) {
    res.status(400);
    throw new Error("Department code is required (max 20 chars)");
  }

  const existing = await Department.findOne({
    company: req.user.company,
    code: code.trim().toUpperCase(),
  });
  if (existing) {
    res.status(400);
    throw new Error("A department with this code already exists");
  }

  const { shiftStartTime, shiftEndTime } = req.body;
  const dept = await Department.create({
    company: req.user.company,
    name: name.trim(),
    code: code.trim().toUpperCase(),
    head: head || undefined,
    description: description ? String(description).slice(0, 500) : undefined,
    budget: budget ? Number(budget) : 0,
    shiftStartTime: shiftStartTime || undefined,
    shiftEndTime: shiftEndTime || undefined,
  });

  res.status(201).json({ success: true, data: dept });
});

const updateDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!dept) {
    res.status(404);
    throw new Error("Department not found");
  }

  const allowed = [
    "name",
    "head",
    "description",
    "budget",
    "status",
    "shiftStartTime",
    "shiftEndTime",
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) dept[key] = req.body[key];
  }

  await dept.save();
  res.json({ success: true, data: dept });
});

const deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!dept) {
    res.status(404);
    throw new Error("Department not found");
  }

  dept.status = "inactive";
  await dept.save();
  res.json({ success: true, message: "Department deactivated" });
});

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
