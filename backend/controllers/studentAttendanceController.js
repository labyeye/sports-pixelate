const asyncHandler = require("express-async-handler");
const fs = require("fs");
const StudentAttendance = require("../models/StudentAttendance");
const Student = require("../models/Student");
const Employee = require("../models/Employee");
const BiometricLog = require("../models/BiometricLog");
const { safePagination } = require("../middleware/validate");
const { verifyFace } = require("../services/faceService");
const { validateMagicBytes } = require("../middleware/upload");

// Builds a UTC midnight Date for a given calendar day, independent of the
// server process's local timezone. A plain "YYYY-MM-DD" string parses as
// UTC midnight per spec, but the previous `setHours(0,0,0,0)` re-zeroed it
// using the server's LOCAL timezone — on a server east of UTC that rolled
// the stored date back to the previous day, so attendance marked "today"
// from an IST device could be stored (and later read back) as yesterday.
function toDateOnly(d) {
  const match = typeof d === "string" && d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, day] = match;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(day)));
  }
  const date = new Date(d);
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

// Mirrors studentController's coachStudentFilter: a coach only ever sees
// attendance for students assigned to them, never the whole company roster.
async function coachEmployeeId(user) {
  if (user.role !== "employee") return null;
  const employee = await Employee.findOne({ user: user._id }).select(
    "_id role",
  );
  if (!employee || employee.role !== "coach") return null;
  return employee._id;
}

// owner/staff: whole roster (optionally filtered by student/sport/coach/batch/date range).
// coach: only their assigned students. parent: only their linked children's records.
const getStudentAttendance = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query, 50, 200);
  const { student, batch, sport, coach, month, year } = req.query;

  const filter = { company: req.user.company };
  if (req.user.role === "parent") {
    filter.student = { $in: req.user.children || [] };
  } else if (student) {
    filter.student = student;
  }

  const coachId = await coachEmployeeId(req.user);
  const effectiveCoach = coachId || coach;
  if (!filter.student && (sport || effectiveCoach)) {
    const studentFilter = { company: req.user.company };
    if (sport) studentFilter.sport = sport;
    if (effectiveCoach) studentFilter.coach = effectiveCoach;
    const matches = await Student.find(studentFilter).select("_id");
    filter.student = { $in: matches.map((s) => s._id) };
  }
  if (batch) filter.batch = batch;
  if (month && year) {
    const m = parseInt(month),
      y = parseInt(year);
    if (!isNaN(m) && !isNaN(y)) {
      filter.date = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0) };
    }
  }

  const total = await StudentAttendance.countDocuments(filter);
  const records = await StudentAttendance.find(filter)
    .populate("student", "firstName lastName studentId sport batch")
    .populate("markedBy", "name")
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  // "Via" detail for device-originated punches: join BiometricLog by the
  // attendance record it created (manual entries have no log — markedBy
  // already covers who marked those).
  const recordIds = records.map((r) => r._id);
  const logs = recordIds.length
    ? await BiometricLog.find({
        attendance: { $in: recordIds },
        attendanceModel: "StudentAttendance",
      })
        .populate("device", "name")
        .populate("location", "name")
        .sort({ timestamp: 1 })
    : [];
  const logsByAttendance = {};
  for (const log of logs) {
    const key = String(log.attendance);
    (logsByAttendance[key] = logsByAttendance[key] || []).push(log);
  }

  const data = records.map((r) => {
    const obj = r.toObject();
    const recLogs = logsByAttendance[String(r._id)] || [];
    obj.checkInLog = recLogs.find((l) => l.type === "check_in") || null;
    obj.checkOutLog = recLogs.find((l) => l.type === "check_out") || null;
    return obj;
  });

  res.json({
    success: true,
    data,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

// Coach/owner marks one student present/absent/excused for a session date.
const markStudentAttendance = asyncHandler(async (req, res) => {
  const { student, date, status, batch, notes, checkIn, checkOut } = req.body;

  const studentDoc = await Student.findOne({
    _id: student,
    company: req.user.company,
  });
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
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      verifyMode: "manual",
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
  res.json({
    success: true,
    message: `Marked attendance for ${ops.length} student(s)`,
  });
});

// Coach marks a single student present by matching a live photo against the
// student's enrolled face embedding, mirroring the employee self check-in
// flow in attendanceController.selfMarkAttendance.
const markStudentAttendanceByFace = asyncHandler(async (req, res) => {
  const cleanup = () => {
    if (req.file) fs.unlink(req.file.path, () => {});
  };

  if (!req.file) {
    res.status(400);
    throw new Error("Selfie photo is required");
  }

  try {
    await validateMagicBytes(req.file.path); // throws + deletes file if invalid
  } catch (err) {
    res.status(400);
    throw err;
  }

  const { student, date, batch, notes } = req.body;

  const studentDoc = await Student.findOne({
    _id: student,
    company: req.user.company,
  });
  if (!studentDoc) {
    cleanup();
    res.status(404);
    throw new Error("Student not found");
  }

  if (
    !Array.isArray(studentDoc.faceDescriptor) ||
    studentDoc.faceDescriptor.length !== 128
  ) {
    cleanup();
    res.status(400);
    throw new Error("Face not enrolled for this student");
  }

  const { match, distance } = await verifyFace(
    fs.readFileSync(req.file.path),
    req.file.filename,
    req.file.mimetype,
    studentDoc.faceDescriptor,
  );
  if (!match) {
    cleanup();
    res.status(403);
    throw new Error(
      `Face does not match enrolled records (distance: ${distance.toFixed(3)})`,
    );
  }

  const d = toDateOnly(date || Date.now());
  const record = await StudentAttendance.findOneAndUpdate(
    { student, date: d },
    {
      company: req.user.company,
      student,
      date: d,
      status: "present",
      batch: batch ?? studentDoc.batch,
      notes,
      markedBy: req.user._id,
    },
    { upsert: true, new: true },
  ).populate("student", "firstName lastName studentId sport batch");

  res.json({ success: true, data: record, distance });
});

module.exports = {
  getStudentAttendance,
  markStudentAttendance,
  bulkMarkStudentAttendance,
  markStudentAttendanceByFace,
};
