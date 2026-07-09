const asyncHandler = require("express-async-handler");
const Designation = require("../models/Designation");
const Employee = require("../models/Employee");

const getDesignations = asyncHandler(async (req, res) => {
  const desigs = await Designation.find({ company: req.user.company })
    .populate("department", "name")
    .sort({ createdAt: -1 });
  const withCounts = await Promise.all(
    desigs.map(async (d) => {
      const count = await Employee.countDocuments({
        company: req.user.company,
        designation: d.name,
      });
      return { ...d.toObject(), employeeCount: count };
    }),
  );
  res.json({ success: true, data: withCounts });
});

const createDesignation = asyncHandler(async (req, res) => {
  const desig = await Designation.create({
    ...req.body,
    company: req.user.company,
  });
  const populated = await Designation.findById(desig._id).populate(
    "department",
    "name",
  );
  res.status(201).json({
    success: true,
    data: { ...populated.toObject(), employeeCount: 0 },
  });
});

const updateDesignation = asyncHandler(async (req, res) => {
  const desig = await Designation.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    req.body,
    { new: true },
  ).populate("department", "name");
  if (!desig)
    return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: desig });
});

const deleteDesignation = asyncHandler(async (req, res) => {
  await Designation.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  res.json({ success: true, message: "Deleted" });
});

module.exports = {
  getDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
};
