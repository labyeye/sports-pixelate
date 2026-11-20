const asyncHandler = require("express-async-handler");
const MakeupClass = require("../models/MakeupClass");
const Student = require("../models/Student");
const { notifyParentsOfStudent } = require("../services/inAppNotify");

const STATUSES = ["scheduled", "completed", "missed", "cancelled"];
const POP = [
  { path: "student", select: "firstName lastName studentId sport batch" },
  { path: "coach", select: "firstName lastName" },
];
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

exports.getMakeups = asyncHandler(async (req, res) => {
  const q = { company: req.user.company };
  if (req.query.status && STATUSES.includes(req.query.status))
    q.status = req.query.status;
  if (req.query.student) q.student = req.query.student;
  if (req.user.role === "parent") q.student = { $in: req.user.children || [] };
  const data = await MakeupClass.find(q)
    .sort({ scheduledDate: -1 })
    .limit(300)
    .populate(POP);
  res.json({ success: true, data });
});

exports.createMakeup = asyncHandler(async (req, res) => {
  const { student, scheduledDate, missedDate, startTime, batch, coach, note } =
    req.body;
  if (!student || !scheduledDate) {
    res.status(400);
    throw new Error("Student and make-up date are required");
  }
  const when = new Date(scheduledDate);
  if (Number.isNaN(when.getTime())) {
    res.status(400);
    throw new Error("Invalid make-up date");
  }
  const s = await Student.findOne({ _id: student, company: req.user.company });
  if (!s) {
    res.status(404);
    throw new Error("Student not found");
  }
  const doc = await MakeupClass.create({
    company: req.user.company,
    student: s._id,
    sport: s.sport,
    batch: (batch || s.batch || "").trim(),
    missedDate: missedDate || undefined,
    scheduledDate: when,
    startTime: startTime || undefined,
    coach: coach || undefined,
    note: note || "",
    createdBy: req.user._id,
  });
  notifyParentsOfStudent(s._id, req.user.company, {
    type: "general",
    title: "Make-up class scheduled",
    message: `${s.firstName}'s make-up class is on ${fmtDate(when)}${startTime ? ` at ${startTime}` : ""}.`,
    student: s._id,
  });
  await doc.populate(POP);
  res.status(201).json({ success: true, data: doc });
});

exports.updateMakeup = asyncHandler(async (req, res) => {
  const doc = await MakeupClass.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!doc) {
    res.status(404);
    throw new Error("Make-up class not found");
  }
  const { status, scheduledDate, startTime, note } = req.body;
  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      res.status(400);
      throw new Error("Invalid status");
    }
    doc.status = status;
  }
  if (scheduledDate) doc.scheduledDate = new Date(scheduledDate);
  if (startTime !== undefined) doc.startTime = startTime || undefined;
  if (note !== undefined) doc.note = note;
  await doc.save();
  await doc.populate(POP);
  res.json({ success: true, data: doc });
});

exports.deleteMakeup = asyncHandler(async (req, res) => {
  const r = await MakeupClass.deleteOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!r.deletedCount) {
    res.status(404);
    throw new Error("Make-up class not found");
  }
  res.json({ success: true });
});
