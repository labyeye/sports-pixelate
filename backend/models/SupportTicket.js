const mongoose = require("mongoose");

const supportTicketSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ticketNumber: { type: String, unique: true },
    subject: { type: String, required: true, maxlength: 200 },
    issueType: {
      type: String,
      required: true,
      enum: [
        "attendance",
        "leave",
        "payroll",
        "employee_management",
        "performance",
        "recruitment",
        "biometric",
        "billing",
        "reports",
        "departments",
        "loans",
        "exit_management",
        "settings",
        "general",
        "other",
      ],
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    description: { type: String, required: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
    crmTicketId: { type: String, default: null },
    statusUpdatedAt: { type: Date },
    resolvedNote: { type: String, default: "" },
    replies: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

supportTicketSchema.pre("save", async function (next) {
  if (!this.ticketNumber) {
    const count = await mongoose.model("SupportTicket").countDocuments();
    this.ticketNumber = `TKT-${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
