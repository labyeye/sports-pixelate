const asyncHandler = require("express-async-handler");
const Notification = require("../models/Notification");
const { safePagination } = require("../middleware/validate");

const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const filter = { recipient: req.user._id };

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate("student", "firstName lastName studentId")
      .populate("employee", "firstName lastName employeeId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, read: false }),
  ]);

  res.json({
    success: true,
    data: notifications,
    total,
    unreadCount,
    page,
    pages: Math.ceil(total / limit),
  });
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { $set: { read: true } },
    { new: true },
  );
  if (!notification) {
    res.status(404);
    throw new Error("Notification not found");
  }
  res.json({ success: true, data: notification });
});

const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { $set: { read: true } },
  );
  res.json({ success: true });
});

module.exports = { getNotifications, markRead, markAllRead };
