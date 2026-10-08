const asyncHandler = require("express-async-handler");
const fs = require("fs");
const StudentAttendance = require("../models/StudentAttendance");
const Student = require("../models/Student");
const Employee = require("../models/Employee");
const BiometricLog = require("../models/BiometricLog");
const { safePagination } = require("../middleware/validate");
const { verifyFace } = require("../services/faceService");
const { isStudentFaceEnabled } = require("../services/faceIndex");
const { validateMagicBytes } = require("../middleware/upload");
const { readDecrypted } = require("../utils/fileCrypto");
const Company = require("../models/Company");
const {
  sendStudentCheckIn,
  sendStudentCheckOut,
} = require("../services/whatsappService");
const { toDateOnly } = require("../utils/dateOnly");
const { resolvePresentStatus } = require("../utils/studentAttendanceRules");
const { getOverdueStudents, studentName } = require("../utils/feeOverdue");
const {
  notifyOwners,
  notifyParentsOfStudent,
  notifyUsers,
} = require("../services/inAppNotify");

// Fires the in-app "student attendance marked" notification to the owner,
// the student's parent(s), and the staff member who marked it (a manual
// mark always has a marker; device/biometric marks are notified separately
// in biometricController.js since markedBy is null there).
async function notifyStudentAttendanceMarked(companyId, studentDoc, status, markedByUserId) {
  const studentName = `${studentDoc.firstName} ${studentDoc.lastName}`.trim();
  const title = "Student attendance marked";
  const message = `${studentName} was marked ${status} today.`;
  const payload = { type: "student_attendance", title, message, student: studentDoc._id };

  await Promise.all([
    notifyOwners(companyId, payload),
    notifyParentsOfStudent(studentDoc._id, companyId, payload),
    markedByUserId ? notifyUsers(companyId, [markedByUserId], payload) : null,
  ]);
}

// WhatsApp the opted-in guardian (receivesWhatsapp) for manual / bulk / face
// marks, reusing the biometric check-in/check-out templates. Absent and
// excused marks send nothing. Fire-and-forget: never blocks the response.
async function notifyGuardianWhatsApp(companyId, studentDoc, status, { checkIn, checkOut } = {}) {
  const guardian = (studentDoc.guardians || []).find(
    (g) => g.receivesWhatsapp && g.phone,
  );
  if (!guardian) return;
  const company = await Company.findById(companyId).select("name").lean();
  const base = {
    guardianName: guardian.name,
    studentName: `${studentDoc.firstName} ${studentDoc.lastName}`.trim(),
    locationName: company?.name || "the academy",
  };
  if (status === "present" || status === "late") {
    await sendStudentCheckIn(
      guardian.phone,
      { ...base, time: checkIn || new Date() },
      companyId,
    );
  }
  if (checkOut) {
    await sendStudentCheckOut(
      guardian.phone,
      { ...base, time: checkOut },
      companyId,
    );
  }
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

// Refuses (403, code FEE_OVERDUE) when the owner's fee lock is on and the
// student's fee is overdue past the grace period. Marking someone absent is
// still allowed in bulk (see bulkMark) but a single "present" is blocked.
async function assertFeesCleared(req, res, studentDoc) {
  const { overdue } = await getOverdueStudents(req.user.company, [studentDoc._id]);
  const info = overdue.get(String(studentDoc._id));
  if (!info) return;
  const name = studentName(studentDoc);
  res.status(403);
  const err = new Error(
    `${name} has not paid the fee (overdue by ${info.overdueDays} days). Attendance cannot be taken.`,
  );
  err.code = "FEE_OVERDUE";
  err.details = {
    students: [{ _id: studentDoc._id, name, studentId: studentDoc.studentId, ...info }],
  };
  throw err;
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
      // UTC boundaries to match toDateOnly() above — a local-timezone
      // Date(y, m, 0) on a server east of UTC (e.g. IST) resolves to before
      // the last day's UTC-midnight timestamp, silently dropping that day's
      // records from the month.
      filter.date = {
        $gte: new Date(Date.UTC(y, m - 1, 1)),
        $lte: new Date(Date.UTC(y, m, 0)),
      };
    }
  }

  const total = await StudentAttendance.countDocuments(filter);
  const records = await StudentAttendance.find(filter)
    .populate("student", "firstName lastName studentId sport batch avatar")
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

  await assertFeesCleared(req, res, studentDoc);

  const d = toDateOnly(date || Date.now());
  // A "present" mark arriving >15 min after the session start is "late".
  let finalStatus = status || "present";
  if (finalStatus === "present") {
    finalStatus = await resolvePresentStatus(
      req.user.company,
      student,
      d,
      checkIn ? new Date(checkIn) : new Date(),
    );
  }
  const record = await StudentAttendance.findOneAndUpdate(
    { student, date: d },
    {
      company: req.user.company,
      student,
      date: d,
      status: finalStatus,
      batch: batch ?? studentDoc.batch,
      notes,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      verifyMode: "manual",
      markedBy: req.user._id,
    },
    { upsert: true, new: true },
  ).populate("student", "firstName lastName studentId sport batch avatar");

  notifyStudentAttendanceMarked(
    req.user.company,
    studentDoc,
    record.status,
    req.user._id,
  ).catch((err) => console.error("[notify] markStudentAttendance:", err.message));
  notifyGuardianWhatsApp(req.user.company, studentDoc, record.status, {
    checkIn: record.checkIn,
    checkOut: record.checkOut,
  }).catch((err) => console.error("[whatsapp] markStudentAttendance:", err.message));

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
  }).select("_id firstName lastName studentId guardians");
  const validMap = new Map(validStudents.map((s) => [s._id.toString(), s]));

  const { overdue } = await getOverdueStudents(req.user.company, [...validMap.keys()]);
  const blocked = [];
  const validRecords = records.filter((r) => {
    if (!r.student || !validMap.has(r.student.toString())) return false;
    const info = overdue.get(r.student.toString());
    if (info) {
      const sd = validMap.get(r.student.toString());
      blocked.push({ _id: sd._id, name: studentName(sd), ...info });
      return false;
    }
    return true;
  });
  const now = new Date();
  for (const r of validRecords) {
    r.status = r.status || "present";
    if (r.status === "present") {
      r.status = await resolvePresentStatus(
        req.user.company,
        r.student,
        d,
        r.checkIn ? new Date(r.checkIn) : now,
      );
    }
  }
  const ops = validRecords.map((r) => ({
    updateOne: {
      filter: { student: r.student, date: d },
      update: {
        $set: {
          company: req.user.company,
          status: r.status || "present",
          batch: r.batch,
          notes: r.notes,
          ...(r.checkIn && { checkIn: r.checkIn }),
          markedBy: req.user._id,
        },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) await StudentAttendance.bulkWrite(ops);

  Promise.all(
    validRecords.map((r) =>
      notifyStudentAttendanceMarked(
        req.user.company,
        validMap.get(r.student.toString()),
        r.status || "present",
        req.user._id,
      ),
    ),
  ).catch((err) => console.error("[notify] bulkMarkStudentAttendance:", err.message));
  Promise.all(
    validRecords.map((r) =>
      notifyGuardianWhatsApp(
        req.user.company,
        validMap.get(r.student.toString()),
        r.status || "present",
        { checkIn: r.checkIn || now },
      ),
    ),
  ).catch((err) => console.error("[whatsapp] bulkMarkStudentAttendance:", err.message));

  res.json({
    success: true,
    message: `Marked attendance for ${ops.length} student(s)`,
    blocked,
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

  try {
    await assertFeesCleared(req, res, studentDoc);
  } catch (err) {
    cleanup();
    throw err;
  }

  if (!(await isStudentFaceEnabled(req.user.company))) {
    cleanup();
    res.status(403);
    throw new Error(
      "Face attendance for students is not enabled. Ask the owner to turn it on in Attendance Settings.",
    );
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
    readDecrypted(req.file.path),
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
  const arrivedAt = new Date();
  const faceStatus = await resolvePresentStatus(
    req.user.company,
    student,
    d,
    arrivedAt,
  );
  const record = await StudentAttendance.findOneAndUpdate(
    { student, date: d },
    {
      company: req.user.company,
      student,
      date: d,
      status: faceStatus,
      checkIn: arrivedAt,
      verifyMode: "face",
      batch: batch ?? studentDoc.batch,
      notes,
      markedBy: req.user._id,
    },
    { upsert: true, new: true },
  ).populate("student", "firstName lastName studentId sport batch avatar");

  notifyStudentAttendanceMarked(
    req.user.company,
    studentDoc,
    faceStatus,
    req.user._id,
  ).catch((err) => console.error("[notify] markStudentAttendanceByFace:", err.message));
  notifyGuardianWhatsApp(req.user.company, studentDoc, faceStatus, {
    checkIn: arrivedAt,
  }).catch((err) => console.error("[whatsapp] markStudentAttendanceByFace:", err.message));

  res.json({ success: true, data: record, distance });
});

module.exports = {
  getStudentAttendance,
  markStudentAttendance,
  bulkMarkStudentAttendance,
  markStudentAttendanceByFace,
};
