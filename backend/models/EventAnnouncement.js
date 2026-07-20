const mongoose = require("mongoose");

const eventAnnouncementSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

eventAnnouncementSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model("EventAnnouncement", eventAnnouncementSchema);
