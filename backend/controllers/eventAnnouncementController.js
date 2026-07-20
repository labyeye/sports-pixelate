const asyncHandler = require("express-async-handler");
const EventAnnouncement = require("../models/EventAnnouncement");
const Event = require("../models/Event");

const listAnnouncements = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  const announcements = await EventAnnouncement.find({ event: event._id }).sort(
    { createdAt: -1 },
  );
  res.json({ success: true, data: announcements });
});

const createAnnouncement = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  const { title, message } = req.body;
  if (!title || !message) {
    res.status(400);
    throw new Error("title and message are required");
  }
  const announcement = await EventAnnouncement.create({
    event: event._id,
    company: req.user.company,
    title,
    message,
    postedBy: req.user._id,
  });
  res.status(201).json({ success: true, data: announcement });
});

module.exports = { listAnnouncements, createAnnouncement };
