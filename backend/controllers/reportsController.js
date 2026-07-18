const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const StudentSubscription = require("../models/StudentSubscription");
const Student = require("../models/Student");
const StudentAttendance = require("../models/StudentAttendance");
const Event = require("../models/Event");

// GET /api/reports/student-fees
// Returns student subscriptions (fee records) with student snapshot,
// payment method/verification detail, and an optional single-student filter
// (used by the Payment History report and the student-profile report card).
const getStudentFees = asyncHandler(async (req, res) => {
  const { status, from, to, student } = req.query;
  const filter = { company: req.user.company };
  if (status) filter.status = status;
  if (student) filter.student = student;
  if (from || to) {
    filter.startDate = {};
    if (from) filter.startDate.$gte = new Date(from);
    if (to) filter.startDate.$lte = new Date(to);
  }

  const subs = await StudentSubscription.find(filter)
    .populate("student", "firstName lastName studentId sport batch guardians")
    .populate("confirmedBy", "name")
    .populate("rejectedBy", "name")
    .sort({ startDate: -1 });

  res.json({ success: true, data: subs });
});

// GET /api/reports/student-outstanding
// Returns students with outstanding dues calculated from subscriptions
const getOutstandingDues = asyncHandler(async (req, res) => {
  const { minAmount } = req.query;
  const filter = { company: req.user.company };

  const subs = await StudentSubscription.find(filter)
    .populate("student", "firstName lastName studentId sport batch")
    .sort({ renewalDate: 1 });

  const rows = subs
    .map((s) => {
      const due = (s.amount || 0) - (s.amountPaid || 0);
      return {
        subscriptionId: s._id,
        student: s.student,
        planName: s.planName,
        billingCycle: s.billingCycle,
        amount: s.amount || 0,
        amountPaid: s.amountPaid || 0,
        due,
        status: s.status,
        renewalDate: s.renewalDate,
      };
    })
    .filter((r) => r.due > 0 && (!minAmount || r.due >= Number(minAmount)));

  res.json({ success: true, data: rows });
});

// Builds { studentId: { present, late, absent, excused, total, rate } } for the
// given student ids, scoped to the company (and optionally a date range).
async function attendanceSummaryByStudent(companyId, studentIds, from, to) {
  const match = {
    company: companyId,
    student: { $in: studentIds },
  };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }
  const rows = await StudentAttendance.aggregate([
    { $match: match },
    { $group: { _id: { student: "$student", status: "$status" }, count: { $sum: 1 } } },
  ]);
  const map = {};
  for (const r of rows) {
    const sid = String(r._id.student);
    if (!map[sid]) map[sid] = { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
    map[sid][r._id.status] = (map[sid][r._id.status] || 0) + r.count;
    map[sid].total += r.count;
  }
  for (const sid of Object.keys(map)) {
    const s = map[sid];
    const attended = s.present + s.late;
    s.rate = s.total > 0 ? Math.round((attended / s.total) * 1000) / 10 : 0;
  }
  return map;
}

// Builds { studentId: latestSubscriptionDoc } for the given student ids.
async function latestSubscriptionByStudent(companyId, studentIds) {
  const subs = await StudentSubscription.find({
    company: companyId,
    student: { $in: studentIds },
  }).sort({ startDate: -1 });
  const map = {};
  for (const s of subs) {
    const sid = String(s.student);
    if (!map[sid]) map[sid] = s;
  }
  return map;
}

// Builds { studentId: count } of tournament registrations for the given student ids.
async function tournamentCountByStudent(companyId, studentIds) {
  const idSet = new Set(studentIds.map(String));
  const events = await Event.find({
    company: companyId,
    "registrations.student": { $in: studentIds },
  }).select("registrations");
  const map = {};
  for (const ev of events) {
    for (const reg of ev.registrations || []) {
      const sid = String(reg.student);
      if (idSet.has(sid)) map[sid] = (map[sid] || 0) + 1;
    }
  }
  return map;
}

// GET /api/reports/student-performance
// One row per student: attendance rate, tournaments participated, fee status.
const getStudentPerformance = asyncHandler(async (req, res) => {
  const { sport, batch, search } = req.query;
  const filter = { company: req.user.company };
  if (sport) filter.sport = sport;
  if (batch) filter.batch = batch;
  if (search) {
    const re = new RegExp(search, "i");
    filter.$or = [{ firstName: re }, { lastName: re }, { studentId: re }];
  }

  const students = await Student.find(filter).select(
    "firstName lastName studentId sport batch status",
  );
  const ids = students.map((s) => s._id);

  const [attendanceMap, subMap, tournamentMap] = await Promise.all([
    attendanceSummaryByStudent(req.user.company, ids),
    latestSubscriptionByStudent(req.user.company, ids),
    tournamentCountByStudent(req.user.company, ids),
  ]);

  const rows = students.map((s) => {
    const sid = String(s._id);
    const att = attendanceMap[sid] || { rate: 0, total: 0 };
    const sub = subMap[sid];
    const due = sub ? (sub.amount || 0) - (sub.amountPaid || 0) : 0;
    return {
      student: {
        _id: s._id,
        firstName: s.firstName,
        lastName: s.lastName,
        studentId: s.studentId,
        sport: s.sport,
        batch: s.batch,
      },
      attendanceRate: att.rate,
      tournamentsCount: tournamentMap[sid] || 0,
      feeStatus: sub ? sub.paymentStatus : "no_subscription",
      due,
    };
  });

  res.json({ success: true, data: rows });
});

// GET /api/reports/student-enrollment?from&to
// New enrollments and exits/cancellations within a date range.
const getStudentEnrollment = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);

  const filter = { company: req.user.company };
  const enrollFilter = { ...filter };
  const exitFilter = { ...filter };
  if (from || to) {
    enrollFilter.enrollmentDate = range;
    exitFilter.exitDate = range;
  } else {
    exitFilter.exitDate = { $ne: null };
  }

  const [enrolled, exited] = await Promise.all([
    Student.find(enrollFilter).select(
      "firstName lastName studentId sport batch enrollmentDate status",
    ),
    Student.find(exitFilter).select(
      "firstName lastName studentId sport batch exitDate status",
    ),
  ]);

  const rows = [
    ...enrolled.map((s) => ({
      type: "enrolled",
      student: s,
      date: s.enrollmentDate,
    })),
    ...exited.filter((s) => s.exitDate).map((s) => ({
      type: "exited",
      student: s,
      date: s.exitDate,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json({
    success: true,
    data: rows,
    summary: {
      newEnrollments: enrolled.length,
      exits: exited.filter((s) => s.exitDate).length,
      netChange: enrolled.length - exited.filter((s) => s.exitDate).length,
    },
  });
});

// GET /api/reports/batch-summary  (and ?batch=X for a drill-down)
const getBatchSummary = asyncHandler(async (req, res) => {
  const { batch } = req.query;
  const companyId = req.user.company;

  if (!batch) {
    const groups = await Student.aggregate([
      { $match: { company: companyId } },
      {
        $group: {
          _id: "$batch",
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] } },
          on_hold: { $sum: { $cond: [{ $eq: ["$status", "on_hold"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const rows = groups.map((g) => ({
      batch: g._id || "(No batch)",
      total: g.total,
      active: g.active,
      inactive: g.inactive,
      on_hold: g.on_hold,
    }));
    return res.json({ success: true, data: rows });
  }

  const students = await Student.find({ company: companyId, batch }).select(
    "firstName lastName studentId sport batch status",
  );
  const ids = students.map((s) => s._id);
  const [attendanceMap, subMap] = await Promise.all([
    attendanceSummaryByStudent(companyId, ids),
    latestSubscriptionByStudent(companyId, ids),
  ]);
  const rows = students.map((s) => {
    const sid = String(s._id);
    const att = attendanceMap[sid] || { rate: 0 };
    const sub = subMap[sid];
    return {
      student: s,
      attendanceRate: att.rate,
      feeStatus: sub ? sub.paymentStatus : "no_subscription",
    };
  });
  res.json({ success: true, data: rows });
});

// GET /api/reports/sport-summary  (and ?sport=X for a drill-down)
const getSportSummary = asyncHandler(async (req, res) => {
  const { sport } = req.query;
  const companyId = req.user.company;

  if (!sport) {
    const groups = await Student.aggregate([
      { $match: { company: companyId } },
      {
        $group: {
          _id: "$sport",
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const ids = groups.map((g) => g._id);
    const students = await Student.find({ company: companyId, sport: { $in: ids } }).select("_id sport");
    const bySport = {};
    for (const s of students) {
      (bySport[s.sport] = bySport[s.sport] || []).push(s._id);
    }
    const allStudentIds = students.map((s) => s._id);
    const subs = await StudentSubscription.find({
      company: companyId,
      student: { $in: allStudentIds },
    }).select("student amountPaid");
    const studentToSport = {};
    for (const s of students) studentToSport[String(s._id)] = s.sport;
    const revenueBySport = {};
    for (const sub of subs) {
      const sp = studentToSport[String(sub.student)];
      if (!sp) continue;
      revenueBySport[sp] = (revenueBySport[sp] || 0) + (sub.amountPaid || 0);
    }
    const rows = groups.map((g) => ({
      sport: g._id || "(No sport)",
      total: g.total,
      active: g.active,
      revenue: revenueBySport[g._id] || 0,
    }));
    return res.json({ success: true, data: rows });
  }

  const students = await Student.find({ company: companyId, sport }).select(
    "firstName lastName studentId sport batch status",
  );
  const ids = students.map((s) => s._id);
  const [attendanceMap, subMap] = await Promise.all([
    attendanceSummaryByStudent(companyId, ids),
    latestSubscriptionByStudent(companyId, ids),
  ]);
  const rows = students.map((s) => {
    const sid = String(s._id);
    const att = attendanceMap[sid] || { rate: 0 };
    const sub = subMap[sid];
    return {
      student: s,
      attendanceRate: att.rate,
      feeStatus: sub ? sub.paymentStatus : "no_subscription",
    };
  });
  res.json({ success: true, data: rows });
});

// GET /api/reports/student-profile/:studentId
// Everything needed to render one student's "report card": profile,
// attendance summary, subscription/payment history, tournament participation.
const getStudentProfile = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const companyId = req.user.company;

  const student = await Student.findOne({ _id: studentId, company: companyId })
    .populate("coach", "firstName lastName");
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }

  const [attendanceMap, subscriptions, events] = await Promise.all([
    attendanceSummaryByStudent(companyId, [student._id]),
    StudentSubscription.find({ company: companyId, student: student._id })
      .populate("confirmedBy", "name")
      .sort({ startDate: -1 }),
    Event.find({
      company: companyId,
      "registrations.student": student._id,
    }).select("name activity startDate endDate teams registrations"),
  ]);

  const tournaments = events.map((ev) => {
    const reg = (ev.registrations || []).find(
      (r) => String(r.student) === String(student._id),
    );
    const team = reg?.team
      ? (ev.teams || []).find((t) => String(t._id) === String(reg.team))
      : null;
    return {
      eventName: ev.name,
      activity: ev.activity,
      startDate: ev.startDate,
      endDate: ev.endDate,
      team: team ? team.name : null,
      status: reg?.status || "confirmed",
    };
  });

  res.json({
    success: true,
    data: {
      student,
      attendance: attendanceMap[String(student._id)] || {
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        total: 0,
        rate: 0,
      },
      subscriptions,
      tournaments,
    },
  });
});

module.exports = {
  getStudentFees,
  getOutstandingDues,
  getStudentPerformance,
  getStudentEnrollment,
  getBatchSummary,
  getSportSummary,
  getStudentProfile,
};
