const asyncHandler = require("express-async-handler");
const BatchSchedule = require("../models/BatchSchedule");
const Assessment = require("../models/Assessment");
const Student = require("../models/Student");
const { notifyParentsOfStudent } = require("../services/inAppNotify");

const SLOT_FIELDS = ["sport", "batch", "days", "startTime", "endTime", "coach", "venue"];
const pick = (o, keys) =>
  Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

// ---- Batch timetable -------------------------------------------------------

const getSchedules = asyncHandler(async (req, res) => {
  const filter = { company: req.user.company };
  if (req.user.role === "parent") {
    // Only the (sport, batch) pairs their own children are in.
    const kids = await Student.find({
      _id: { $in: req.user.children || [] },
      company: req.user.company,
    }).select("sport batch");
    if (!kids.length) return res.json({ success: true, data: [] });
    filter.$or = kids.map((k) => ({ sport: k.sport, batch: k.batch }));
  }
  const data = await BatchSchedule.find(filter)
    .populate("coach", "firstName lastName")
    .sort({ sport: 1, batch: 1, startTime: 1 });
  res.json({ success: true, data });
});

const createSchedule = asyncHandler(async (req, res) => {
  const data = await BatchSchedule.create({
    ...pick(req.body, SLOT_FIELDS),
    company: req.user.company,
  });
  res.status(201).json({ success: true, data });
});

const updateSchedule = asyncHandler(async (req, res) => {
  const data = await BatchSchedule.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    pick(req.body, SLOT_FIELDS),
    { new: true, runValidators: true },
  );
  if (!data) {
    res.status(404);
    throw new Error("Schedule not found");
  }
  res.json({ success: true, data });
});

const deleteSchedule = asyncHandler(async (req, res) => {
  const data = await BatchSchedule.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!data) {
    res.status(404);
    throw new Error("Schedule not found");
  }
  res.json({ success: true, message: "Schedule deleted" });
});

// ---- Skill assessments -----------------------------------------------------

const getAssessments = asyncHandler(async (req, res) => {
  const filter = { company: req.user.company };
  if (req.user.role === "parent") {
    const mine = (req.user.children || []).map(String);
    if (req.query.student && !mine.includes(String(req.query.student)))
      return res.json({ success: true, data: [] });
    filter.student = req.query.student || { $in: mine };
  } else if (req.query.student) filter.student = req.query.student;
  const data = await Assessment.find(filter)
    .populate("assessedBy", "name")
    .sort({ date: -1 })
    .limit(200);
  res.json({ success: true, data });
});

const createAssessment = asyncHandler(async (req, res) => {
  const { student, date, level, ratings, remarks } = req.body;
  const stu = await Student.findOne({ _id: student, company: req.user.company });
  if (!stu) {
    res.status(404);
    throw new Error("Student not found");
  }
  const data = await Assessment.create({
    company: req.user.company,
    student: stu._id,
    assessedBy: req.user._id,
    date,
    level,
    ratings,
    remarks,
  });
  await notifyParentsOfStudent(stu._id, req.user.company, {
    type: "general",
    title: "New progress report",
    message: `${stu.firstName}'s coach added a new skill assessment${level ? ` (${level})` : ""}.`,
    student: stu._id,
  });
  res.status(201).json({ success: true, data });
});

const deleteAssessment = asyncHandler(async (req, res) => {
  const data = await Assessment.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!data) {
    res.status(404);
    throw new Error("Assessment not found");
  }
  res.json({ success: true, message: "Assessment deleted" });
});

module.exports = {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getAssessments,
  createAssessment,
  deleteAssessment,
};
