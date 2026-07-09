const asyncHandler = require("express-async-handler");
const SupportTicket = require("../models/SupportTicket");
const Company = require("../models/Company");

const ISSUE_LABELS = {
  attendance: "Attendance",
  leave: "Leave Management",
  payroll: "Payroll & Salary",
  employee_management: "Employee Management",
  performance: "Performance Review",
  recruitment: "Recruitment",
  biometric: "Biometric & Devices",
  billing: "Billing & Subscription",
  reports: "Reports",
  departments: "Departments",
  loans: "Loans & Advances",
  exit_management: "Exit Management",
  settings: "Settings",
  general: "General Inquiry",
  other: "Other",
};

async function notifyCrm(ticket, companyName, userName) {
  const webhookUrl = process.env.CRM_SUPPORT_WEBHOOK_URL;
  if (!webhookUrl) return null;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CRM_API_SECRET || "",
      },
      body: JSON.stringify({
        hrmsTicketId: ticket._id.toString(),
        ticketNumber: ticket.ticketNumber,
        companyName,
        submittedBy: userName,
        subject: ticket.subject,
        issueType: ticket.issueType,
        issueTypeLabel: ISSUE_LABELS[ticket.issueType] || ticket.issueType,
        priority: ticket.priority,
        description: ticket.description,
        status: ticket.status,
        createdAt: ticket.createdAt,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      return json.crmTicketId || null;
    }
  } catch (_) {}
  return null;
}

exports.createTicket = asyncHandler(async (req, res) => {
  const { subject, issueType, priority, description } = req.body;

  if (!subject || !subject.trim())
    return res
      .status(400)
      .json({ success: false, message: "Subject is required" });
  if (!issueType)
    return res
      .status(400)
      .json({ success: false, message: "Issue type is required" });
  if (!description || !description.trim())
    return res
      .status(400)
      .json({ success: false, message: "Description is required" });
  if (description.length > 2000)
    return res.status(400).json({
      success: false,
      message: "Description too long (max 2000 chars)",
    });

  const company = await Company.findById(req.user.company);

  const ticket = await SupportTicket.create({
    company: req.user.company,
    submittedBy: req.user._id,
    subject: subject.trim().slice(0, 200),
    issueType,
    priority: priority || "medium",
    description: description.trim(),
  });

  const crmTicketId = await notifyCrm(
    ticket,
    company?.name || "Unknown",
    req.user.name || req.user.email,
  );

  if (crmTicketId) {
    await SupportTicket.findByIdAndUpdate(ticket._id, { crmTicketId });
    ticket.crmTicketId = crmTicketId;
  }

  res.status(201).json({ success: true, data: ticket });
});

exports.getMyTickets = asyncHandler(async (req, res) => {
  const filter = { company: req.user.company };

  const adminRoles = ["super_admin", "hr_manager", "hr_executive"];
  if (!adminRoles.includes(req.user.role)) {
    filter.submittedBy = req.user._id;
  }

  const tickets = await SupportTicket.find(filter)
    .populate("submittedBy", "name email")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: tickets });
});

exports.getTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findOne({
    _id: req.params.id,
    company: req.user.company,
  })
    .populate("submittedBy", "name email")
    .populate("replies.user", "name role email");

  if (!ticket)
    return res
      .status(404)
      .json({ success: false, message: "Ticket not found" });
  res.json({ success: true, data: ticket });
});

// Called by CRM via webhook to update ticket status
exports.updateTicketStatus = asyncHandler(async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.CRM_API_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { status, resolvedNote } = req.body;
  const allowed = ["open", "in_progress", "resolved", "closed"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }

  const ticket = await SupportTicket.findByIdAndUpdate(
    req.params.id,
    { status, resolvedNote: resolvedNote || "", statusUpdatedAt: new Date() },
    { new: true },
  );

  if (!ticket)
    return res
      .status(404)
      .json({ success: false, message: "Ticket not found" });
  res.json({ success: true, data: ticket });
});

exports.replyToTicket = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    res.status(400);
    throw new Error("Message is required");
  }

  const filter = { _id: req.params.id, company: req.user.company };
  if (req.user.role === "employee") {
    filter.submittedBy = req.user._id;
  }

  const ticket = await SupportTicket.findOne(filter);
  if (!ticket) {
    res.status(404);
    throw new Error("Ticket not found");
  }

  if (ticket.status === "closed") {
    res.status(400);
    throw new Error("Cannot reply to a closed ticket");
  }

  ticket.replies.push({
    user: req.user._id,
    message: message.trim(),
    createdAt: new Date(),
  });

  if (req.user.role !== "employee" && ticket.status === "open") {
    ticket.status = "in_progress";
  }

  await ticket.save();
  const populated = await SupportTicket.findById(ticket._id)
    .populate("submittedBy", "name email")
    .populate("replies.user", "name role email");

  res.json({ success: true, data: populated });
});

exports.closeTicket = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, company: req.user.company };
  if (req.user.role === "employee") {
    filter.submittedBy = req.user._id;
  }

  const ticket = await SupportTicket.findOne(filter);
  if (!ticket) {
    res.status(404);
    throw new Error("Ticket not found");
  }

  ticket.status = "closed";
  ticket.statusUpdatedAt = new Date();

  await ticket.save();
  res.json({ success: true, data: ticket });
});
