const mongoose = require("mongoose");

const eventGalleryItemSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    url: { type: String, required: true, trim: true },
    caption: { type: String, trim: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

eventGalleryItemSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model("EventGalleryItem", eventGalleryItemSchema);
