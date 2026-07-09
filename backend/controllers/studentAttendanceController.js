const asyncHandler = require("express-async-handler");
const StudentAttendance = require("../models/StudentAttendance");
const Student = require("../models/Student");
const { safePagination } = require("../middleware/validate");

function toDateOnly(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

// owner/staff: whole roster (optionally filtered by student/batch/date range).
// parent: only their linked children's records.
const getStudentAttendance = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query, 50, 200);
  const { student, batch, month, year } = req.query;

  const filter = { company: req.user.company };
  if (req.user.role === "parent") {
    filter.student = { $in: req.user.children || [] };
  } else if (student) {
    filter.student = student;
  }
  if (batch) filter.batch = batch;
  if (month && year) {
    const m = parseInt(month), y = parseInt(year);
    if (!isNaN(m) && !isNaN(y)) {
      filter.date = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0) };
    }
  }

  const total = await StudentAttendance.countDocuments(filter);
  const records = await StudentAttendance.find(filter)
    .populate("student", "firstName lastName studentId sport batch")
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  res.json({ success: true, data: records, total, page, pages: Math.ceil(total / limit) });
});

// Coach/owner marks one student present/absent/excused for a session date.
const markStudentAttendance = asyncHandler(async (req, res) => {
  const { student, date, status, batch, notes } = req.body;

  const studentDoc = await Student.findOne({ _id: student, company: req.user.company });
  if (!studentDoc) {
    res.status(404);
    throw new Error("Student not found");
  }

  const d = toDateOnly(date || Date.now());
  const record = await StudentAttendance.findOneAndUpdate(
    { student, date: d },
    {
      company: req.user.company,
      student,
      date: d,
      status: status || "present",
      batch: batch ?? studentDoc.batch,
      notes,
      markedBy: req.user._id,
    },
    { upsert: true, new: true },
  ).populate("student", "firstName lastName studentId sport batch");

  res.json({ success: true, data: record });
});

// Mark a whole batch/session in one call (coach takes attendance for a class).
const bulkMarkStudentAttendance = asyncHandler(async (req, res) => {
  const { date, records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    res.status(400);
    throw new Error("records must be a non-empty array");
  }
  if (records.length > 300) {
    res.status(400);
    throw new Error("Cannot bulk mark more than 300 records at once");
  }

  const d = toDateOnly(date);
  const studentIds = records.map((r) => r.student).filter(Boolean);
  const validStudents = await Student.find({
    _id: { $in: studentIds },
    company: req.user.company,
  }).select("_id");
  const validSet = new Set(validStudents.map((s) => s._id.toString()));

  const ops = records
    .filter((r) => r.student && validSet.has(r.student.toString()))
    .map((r) => ({
      updateOne: {
        filter: { student: r.student, date: d },
        update: {
          $set: {
            company: req.user.company,
            status: r.status || "present",
            batch: r.batch,
            notes: r.notes,
            markedBy: req.user._id,
          },
        },
        upsert: true,
      },
    }));

  if (ops.length > 0) await StudentAttendance.bulkWrite(ops);
  res.json({ success: true, message: `Marked attendance for ${ops.length} student(s)` });
});

module.exports = {
  getStudentAttendance,
  markStudentAttendance,
  bulkMarkStudentAttendance,
};
