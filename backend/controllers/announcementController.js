const asyncHandler = require("express-async-handler");
const Announcement = require("../models/Announcement");

exports.createAnnouncement = asyncHandler(async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    res.status(400);
    throw new Error("Title and content are required");
  }
  const announcement = await Announcement.create({
    company: req.user.company,
    title,
    content,
  });
  res.status(201).json({ success: true, data: announcement });
});

exports.getAnnouncements = asyncHandler(async (req, res) => {
  const filter = { company: req.user.company };
  if (req.user.role === "employee") {
    filter.active = true;
  }
  const announcements = await Announcement.find(filter).sort({ date: -1 });
  res.json({ success: true, data: announcements });
});

exports.deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!announcement) {
    res.status(404);
    throw new Error("Announcement not found");
  }
  await announcement.deleteOne();
  res.json({ success: true, message: "Announcement deleted" });
});
