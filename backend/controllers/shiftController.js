const asyncHandler = require("express-async-handler");
const Shift = require("../models/Shift");

const getShifts = asyncHandler(async (req, res) => {
  const shifts = await Shift.find({ company: req.user.company }).sort({
    order: 1,
    createdAt: 1,
  });
  res.json({ success: true, data: shifts });
});

const createShift = asyncHandler(async (req, res) => {
  const shift = await Shift.create({ ...req.body, company: req.user.company });
  res.status(201).json({ success: true, data: shift });
});

const updateShift = asyncHandler(async (req, res) => {
  const shift = await Shift.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    req.body,
    { new: true },
  );
  if (!shift)
    return res.status(404).json({ success: false, message: "Shift not found" });
  res.json({ success: true, data: shift });
});

const deleteShift = asyncHandler(async (req, res) => {
  await Shift.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  res.json({ success: true, message: "Deleted" });
});

module.exports = { getShifts, createShift, updateShift, deleteShift };
