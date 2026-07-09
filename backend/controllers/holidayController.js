const asyncHandler = require("express-async-handler");
const Holiday = require("../models/Holiday");
const { safePagination } = require("../middleware/validate");

const HOLIDAY_TYPES = ["national", "optional", "restricted"];

const getHolidays = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query, 100, 400);
  const { year } = req.query;
  const filter = { company: req.user.company };

  if (year) {
    const y = parseInt(year);
    if (!isNaN(y)) {
      filter.date = {
        $gte: new Date(`${y}-01-01`),
        $lte: new Date(`${y}-12-31`),
      };
    }
  }

  const total = await Holiday.countDocuments(filter);
  const holidays = await Holiday.find(filter)
    .sort({ date: 1 })
    .skip(skip)
    .limit(limit);
  res.json({ success: true, data: holidays, total });
});

const createHoliday = asyncHandler(async (req, res) => {
  const { name, date, type, description } = req.body;

  if (
    !name ||
    typeof name !== "string" ||
    name.trim().length < 1 ||
    name.trim().length > 100
  ) {
    res.status(400);
    throw new Error("Holiday name is required (max 100 chars)");
  }
  if (!date || isNaN(new Date(date).getTime())) {
    res.status(400);
    throw new Error("Valid date is required");
  }

  const holiday = await Holiday.create({
    company: req.user.company,
    name: name.trim(),
    date: new Date(date),
    type: type && HOLIDAY_TYPES.includes(type) ? type : "national",
    description: description ? String(description).slice(0, 500) : undefined,
  });

  res.status(201).json({ success: true, data: holiday });
});

const updateHoliday = asyncHandler(async (req, res) => {
  const holiday = await Holiday.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!holiday) {
    res.status(404);
    throw new Error("Holiday not found");
  }

  const { name, date, type, description, isActive } = req.body;
  if (name !== undefined) holiday.name = String(name).trim().slice(0, 100);
  if (date !== undefined) {
    if (isNaN(new Date(date).getTime())) {
      res.status(400);
      throw new Error("Invalid date");
    }
    holiday.date = new Date(date);
  }
  if (type !== undefined && HOLIDAY_TYPES.includes(type)) holiday.type = type;
  if (description !== undefined)
    holiday.description = String(description).slice(0, 500);
  if (isActive !== undefined) holiday.isActive = !!isActive;

  await holiday.save();
  res.json({ success: true, data: holiday });
});

const deleteHoliday = asyncHandler(async (req, res) => {
  const holiday = await Holiday.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!holiday) {
    res.status(404);
    throw new Error("Holiday not found");
  }
  await holiday.deleteOne();
  res.json({ success: true, message: "Holiday deleted" });
});

const isHolidayDate = async (companyId, date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  return Holiday.findOne({
    company: companyId,
    date: { $gte: d, $lt: next },
    isActive: true,
  });
};

module.exports = {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  isHolidayDate,
};
