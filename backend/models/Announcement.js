const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    date: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Announcement", announcementSchema);
