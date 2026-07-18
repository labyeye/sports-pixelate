const asyncHandler = require("express-async-handler");
const EventGalleryItem = require("../models/EventGalleryItem");
const Event = require("../models/Event");

const listGalleryItems = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  const items = await EventGalleryItem.find({ event: event._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: items });
});

const addGalleryItem = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  if (!req.file) {
    res.status(400);
    throw new Error("No photo uploaded");
  }
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const item = await EventGalleryItem.create({
    event: event._id,
    company: req.user.company,
    url: `${baseUrl}/uploads/event-gallery/${req.file.filename}`,
    caption: req.body?.caption,
    uploadedBy: req.user._id,
  });
  res.status(201).json({ success: true, data: item });
});

const deleteGalleryItem = asyncHandler(async (req, res) => {
  const item = await EventGalleryItem.findOneAndDelete({
    _id: req.params.itemId,
    event: req.params.id,
    company: req.user.company,
  });
  if (!item) {
    res.status(404);
    throw new Error("Gallery item not found");
  }
  res.json({ success: true, message: "Gallery item deleted" });
});

module.exports = { listGalleryItems, addGalleryItem, deleteGalleryItem };
