const asyncHandler = require("express-async-handler");
const Asset = require("../models/Asset");
const Employee = require("../models/Employee");

exports.createAsset = asyncHandler(async (req, res) => {
  const { name, assetType, serialNumber, employeeId } = req.body;
  if (!name || !assetType || !serialNumber) {
    res.status(400);
    throw new Error("name, assetType, and serialNumber are required");
  }

  let employee = null;
  let status = "available";
  let assignmentDate = null;
  let history = [];

  if (employeeId) {
    const emp = await Employee.findOne({
      _id: employeeId,
      company: req.user.company,
    });
    if (!emp) {
      res.status(404);
      throw new Error("Employee not found");
    }
    employee = employeeId;
    status = "assigned";
    assignmentDate = new Date();
    history = [
      {
        employee: employeeId,
        assignedAt: assignmentDate,
        notes: "Initial assignment on creation",
      },
    ];
  }

  const asset = await Asset.create({
    company: req.user.company,
    employee,
    name,
    assetType,
    serialNumber,
    status,
    assignmentDate,
    history,
  });

  res.status(201).json({ success: true, data: asset });
});

exports.getAssets = asyncHandler(async (req, res) => {
  const filter = { company: req.user.company };

  if (req.user.role === "employee") {
    const emp = await Employee.findOne({ user: req.user._id });
    if (!emp) return res.json({ success: true, data: [] });
    filter.employee = emp._id;
  } else if (req.query.employeeId) {
    filter.employee = req.query.employeeId;
  }

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const assets = await Asset.find(filter)
    .populate("employee", "firstName lastName employeeId designation")
    .populate("history.employee", "firstName lastName employeeId")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: assets });
});

exports.assignAsset = asyncHandler(async (req, res) => {
  const { employeeId, notes } = req.body;
  if (!employeeId) {
    res.status(400);
    throw new Error("employeeId is required");
  }

  const emp = await Employee.findOne({
    _id: employeeId,
    company: req.user.company,
  });
  if (!emp) {
    res.status(404);
    throw new Error("Employee not found");
  }

  const asset = await Asset.findOne({
    _id: req.params.id,
    company: req.user.company,
  });

  if (!asset) {
    res.status(404);
    throw new Error("Asset not found");
  }

  asset.employee = employeeId;
  asset.status = "assigned";
  asset.assignmentDate = new Date();
  asset.returnDate = undefined;
  asset.history.push({
    employee: employeeId,
    assignedAt: new Date(),
    notes: notes || "Assigned",
  });

  await asset.save();
  res.json({ success: true, data: asset });
});

exports.returnAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findOne({
    _id: req.params.id,
    company: req.user.company,
  });

  if (!asset) {
    res.status(404);
    throw new Error("Asset not found");
  }

  // Update last history entry
  const lastIndex = asset.history.length - 1;
  if (lastIndex >= 0 && !asset.history[lastIndex].returnedAt) {
    asset.history[lastIndex].returnedAt = new Date();
    asset.history[lastIndex].notes =
      (asset.history[lastIndex].notes || "") + " (Returned)";
  }

  asset.employee = null;
  asset.status = "available";
  asset.returnDate = new Date();
  asset.assignmentDate = undefined;

  await asset.save();
  res.json({ success: true, data: asset });
});

exports.deleteAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!asset) {
    res.status(404);
    throw new Error("Asset not found");
  }
  await asset.deleteOne();
  res.json({ success: true, message: "Asset deleted" });
});
