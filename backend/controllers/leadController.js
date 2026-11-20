const consent = require("../utils/parentalConsent");
const {
  assertStudentSlot,
  lastStudentNumber,
} = require("../utils/studentLimit");
const asyncHandler = require("express-async-handler");
const Lead = require("../models/Lead");
const Student = require("../models/Student");
const { STATUSES } = Lead;

const EDITABLE = [
  "childName",
  "age",
  "guardianName",
  "phone",
  "email",
  "sport",
  "batch",
  "source",
  "trialDate",
  "followUpDate",
  "assignedTo",
];

function pick(body) {
  const out = {};
  for (const k of EDITABLE) if (body[k] !== undefined) out[k] = body[k];
  for (const k of ["trialDate", "followUpDate", "assignedTo", "age"]) {
    if (out[k] === "" || out[k] === null) out[k] = undefined;
  }
  return out;
}

const findLead = async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, company: req.user.company });
  if (!lead) {
    res.status(404);
    throw new Error("Enquiry not found");
  }
  return lead;
};

exports.getLeads = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const q = { company: req.user.company };
  if (status && STATUSES.includes(status)) q.status = status;
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    q.$or = [{ childName: rx }, { guardianName: rx }, { phone: rx }];
  }
  const leads = await Lead.find(q)
    .sort({ createdAt: -1 })
    .limit(500)
    .populate("assignedTo", "name");

  const now = new Date();
  const [counts, overdue] = await Promise.all([
    Lead.aggregate([
      { $match: { company: req.user.company } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    Lead.countDocuments({
      company: req.user.company,
      status: { $nin: ["converted", "lost"] },
      followUpDate: { $lt: now },
    }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  const total = counts.reduce((s, c) => s + c.n, 0);
  const converted = byStatus.converted || 0;
  res.json({
    success: true,
    data: leads,
    summary: {
      total,
      byStatus,
      overdueFollowUps: overdue,
      conversionRate: total ? Math.round((converted / total) * 100) : 0,
    },
  });
});

exports.createLead = asyncHandler(async (req, res) => {
  const data = pick(req.body);
  if (!data.childName?.trim() || !data.phone?.trim()) {
    res.status(400);
    throw new Error("Child name and phone are required");
  }
  const lead = await Lead.create({
    ...data,
    company: req.user.company,
    assignedTo: data.assignedTo || req.user._id,
  });
  res.status(201).json({ success: true, data: lead });
});

exports.updateLead = asyncHandler(async (req, res) => {
  const lead = await findLead(req, res);
  Object.assign(lead, pick(req.body));
  if (!lead.childName?.trim() || !lead.phone?.trim()) {
    res.status(400);
    throw new Error("Child name and phone are required");
  }
  await lead.save();
  res.json({ success: true, data: lead });
});

exports.updateLeadStatus = asyncHandler(async (req, res) => {
  const { status, lostReason, trialDate, followUpDate } = req.body;
  if (!STATUSES.includes(status) || status === "converted") {
    res.status(400);
    throw new Error("Invalid status (use the convert action to enrol a student)");
  }
  const lead = await findLead(req, res);
  if (lead.status === "converted") {
    res.status(400);
    throw new Error("This enquiry is already converted");
  }
  if (status === "trial_scheduled" && !(trialDate || lead.trialDate)) {
    res.status(400);
    throw new Error("Pick a trial date");
  }
  lead.status = status;
  if (trialDate) lead.trialDate = trialDate;
  if (followUpDate !== undefined) lead.followUpDate = followUpDate || undefined;
  if (status === "lost") lead.lostReason = (lostReason || "").trim();
  await lead.save();
  res.json({ success: true, data: lead });
});

exports.addLeadNote = asyncHandler(async (req, res) => {
  const text = (req.body.text || "").trim();
  if (!text) {
    res.status(400);
    throw new Error("Note is empty");
  }
  const lead = await findLead(req, res);
  lead.notes.push({ text, by: req.user._id });
  await lead.save();
  res.json({ success: true, data: lead });
});

// Creates the Student from the enquiry (guardian contact kept, no login — the
// owner can add parent credentials from the student's profile afterwards).
exports.convertLead = asyncHandler(async (req, res) => {
  const lead = await findLead(req, res);
  if (lead.status === "converted") {
    res.status(400);
    throw new Error("This enquiry is already converted");
  }
  const sport = (req.body.sport || lead.sport || "").trim();
  if (!sport) {
    res.status(400);
    throw new Error("Sport is required to enrol");
  }
  const [firstName, ...rest] = lead.childName.trim().split(/\s+/);
  if (!consent.given(req.body)) {
    res.status(400);
    throw new Error(consent.MESSAGE);
  }
  await assertStudentSlot(req.user.company, res);
  const count = await lastStudentNumber(req.user.company);
  const student = await Student.create({
    company: req.user.company,
    studentId: `STU${String(count + 1).padStart(4, "0")}`,
    firstName,
    lastName: rest.join(" ") || "-",
    sport,
    batch: (req.body.batch || lead.batch || "").trim(),
    guardians: lead.guardianName
      ? [{ relation: "guardian", name: lead.guardianName, phone: lead.phone, email: lead.email || undefined }]
      : [],
    emergencyContact: lead.phone,
    enrollmentDate: Date.now(),
    guardianConsent: consent.consentFor(req),
  });
  await consent.recordConsent(req, student);
  lead.status = "converted";
  lead.student = student._id;
  lead.convertedAt = new Date();
  lead.followUpDate = undefined;
  await lead.save();
  res.status(201).json({ success: true, data: { lead, student } });
});

exports.deleteLead = asyncHandler(async (req, res) => {
  const lead = await findLead(req, res);
  await lead.deleteOne();
  res.json({ success: true });
});
