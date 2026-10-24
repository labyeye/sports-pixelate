const asyncHandler = require("express-async-handler");
const AuditLog = require("../models/AuditLog");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const User = require("../models/User");
const Session = require("../models/Session");
const { safePagination, escapeRegex } = require("../middleware/validate");

const getLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { action, entity, userId, startDate, endDate } = req.query;

  const filter = { company: req.user.company };
  if (action)
    filter.action = {
      $regex: escapeRegex(String(action).slice(0, 100)),
      $options: "i",
    };
  if (entity) filter.entity = entity;
  if (userId) filter.user = userId;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const total = await AuditLog.countDocuments(filter);
  const logs = await AuditLog.find(filter)
    .populate("user", "name email role")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: logs,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const IST_MS = 5.5 * 3600000;
const istToday = () => new Date(Date.now() + IST_MS).toISOString().slice(0, 10);

// Who checked in / out and when, plus who signed in (and from which device), merged into one
// newest-first timeline. Query: type=all|attendance|login, startDate/endDate (YYYY-MM-DD, IST), page, limit.
const getActivity = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const type = ["attendance", "login"].includes(req.query.type)
    ? req.query.type
    : "all";
  const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
  let startDay = isDay(req.query.startDate) ? req.query.startDate : istToday();
  let endDay = isDay(req.query.endDate) ? req.query.endDate : startDay;
  if (endDay < startDay) [startDay, endDay] = [endDay, startDay];
  const spanDays = (new Date(endDay) - new Date(startDay)) / 86400000;
  if (spanDays > 31) {
    res.status(400);
    throw new Error("Choose a range of 31 days or less");
  }
  const from = new Date(`${startDay}T00:00:00+05:30`);
  const to = new Date(`${endDay}T23:59:59.999+05:30`);
  const events = [];

  if (type !== "login") {
    const emps = await Employee.find({ company: req.user.company })
      .select("firstName lastName employeeId designation")
      .lean();
    const byId = new Map(emps.map((e) => [String(e._id), e]));
    const rows = await Attendance.find({
      employee: { $in: emps.map((e) => e._id) },
      date: {
        $gte: new Date(`${startDay}T00:00:00Z`),
        $lte: new Date(`${endDay}T00:00:00Z`),
      },
      $or: [{ checkIn: { $ne: null } }, { checkOut: { $ne: null } }],
    })
      .select(
        "employee checkIn checkOut status verifyMode checkInLocation checkOutLocation workHours",
      )
      .lean();
    for (const r of rows) {
      const e = byId.get(String(r.employee));
      if (!e) continue;
      const base = {
        name: `${e.firstName || ""} ${e.lastName || ""}`.trim(),
        sub: [e.employeeId, e.designation].filter(Boolean).join(" · "),
        via: r.verifyMode,
        status: r.status,
      };
      if (r.checkIn)
        events.push({
          ...base,
          id: `${r._id}-in`,
          kind: "check_in",
          at: r.checkIn,
          distance: r.checkInLocation?.distanceMeters,
        });
      if (r.checkOut)
        events.push({
          ...base,
          id: `${r._id}-out`,
          kind: "check_out",
          at: r.checkOut,
          distance: r.checkOutLocation?.distanceMeters,
          workHours: r.workHours,
        });
    }
  }

  if (type !== "attendance") {
    const logs = await AuditLog.find({
      company: req.user.company,
      action: { $in: ["auth.login", "auth.logout"] },
      createdAt: { $gte: from, $lte: to },
    }).lean();
    const seen = new Set(
      logs.map((l) => String(l.details?.sessionId)).filter(Boolean),
    );
    for (const l of logs)
      events.push({
        id: String(l._id),
        kind: l.action === "auth.login" ? "login" : "logout",
        at: l.createdAt,
        name: l.userName || l.userEmail || "Unknown",
        sub: l.userEmail || "",
        device: l.details?.device,
        platform: l.details?.platform,
        ip: l.ip,
      });
    // Sessions opened before login events were recorded.
    const users = await User.find({ company: req.user.company })
      .select("name email")
      .lean();
    const uById = new Map(users.map((u) => [String(u._id), u]));
    const sessions = await Session.find({
      userId: { $in: users.map((u) => u._id) },
      createdAt: { $gte: from, $lte: to },
    }).lean();
    for (const s of sessions) {
      if (seen.has(String(s._id))) continue;
      const u = uById.get(String(s.userId));
      events.push({
        id: `s-${s._id}`,
        kind: "login",
        at: s.createdAt,
        name: u?.name || u?.email || "Unknown",
        sub: u?.email || "",
        device: s.deviceName,
        platform: s.platform,
        ip: s.ip,
      });
    }
  }

  events.sort((a, b) => new Date(b.at) - new Date(a.at));
  res.json({
    success: true,
    data: events.slice(skip, skip + limit),
    total: events.length,
    page,
    pages: Math.ceil(events.length / limit),
    summary: {
      checkIns: events.filter((e) => e.kind === "check_in").length,
      checkOuts: events.filter((e) => e.kind === "check_out").length,
      logins: events.filter((e) => e.kind === "login").length,
    },
  });
});

module.exports = { getLogs, getActivity };
