const mongoose = require("mongoose");

// One owner broadcast to parents over WhatsApp. Each recipient keeps its own status so
// "resend to the ones who didn't get it" only touches the failed ones.
const recipientSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    studentName: String,
    name: String,
    phone: String,
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    error: String,
    wamid: String,
    attempts: { type: Number, default: 0 },
    sentAt: Date,
  },
  { _id: true },
);

const bulkMessageSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: { type: String, default: "" },
    // Meta media id is reused for resends (valid ~30 days), so the file is never stored by us
    doc: { mediaId: String, filename: String, mimetype: String },
    audience: { type: String, enum: ["all", "custom"], default: "all" },
    running: { type: Boolean, default: false },
    recipients: [recipientSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("BulkMessage", bulkMessageSchema);
