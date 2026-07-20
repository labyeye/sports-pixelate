const asyncHandler = require("express-async-handler");
const EventAttendance = require("../models/EventAttendance");
const Event = require("../models/Event");

// Read-only shell — no QR check-in/attendance-marking subsystem yet.
const listAttendance = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  const records = await EventAttendance.find({ event: event._id })
    .populate("student", "firstName lastName avatar")
    .sort({ createdAt: -1 });
  res.json({ success: true, data: records });
});

module.exports = { listAttendance };
