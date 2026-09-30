const mongoose = require("mongoose");

// A single in-app notification for one recipient User. Every attendance
// event (student or employee) that should surface in the bell/notification
// center writes one of these per recipient (owner, parent, marking staff,
// the employee themself, ...) — unlike WhatsApp/push, this is always
// queryable and mark-as-read, independent of phone numbers or subscriptions.
const notificationSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "student_attendance",
        "employee_attendance",
        "general",
      ],
      default: "general",
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
