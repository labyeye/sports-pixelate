const asyncHandler = require("express-async-handler");
const AuditLog = require("../models/AuditLog");
const { safePagination } = require("../middleware/validate");

const getLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { action, entity, userId, startDate, endDate } = req.query;

  const filter = { company: req.user.company };
  if (action) filter.action = { $regex: action, $options: "i" };
  if (entity) filter.entity = entity;
  if (userId) filter.user = userId;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const total = await AuditLog.countDocuments(filter);
  const logs = await AuditLog.find(filter)
    .populate("user", "name email role")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: logs,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

module.exports = { getLogs };
