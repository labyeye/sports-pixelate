const asyncHandler = require("express-async-handler");
const Student = require("../models/Student");
const StudentSubscription = require("../models/StudentSubscription");
const StudentAttendance = require("../models/StudentAttendance");
const Expense = require("../models/Expense");

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// First day of each of the last 6 months, oldest first.
function lastSixMonths(now = new Date()) {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { start: d, end: new Date(d.getFullYear(), d.getMonth() + 1, 1), label: MONTHS[d.getMonth()] };
  });
}

// GET /api/insights/students — roster numbers for the Students page.
const studentInsights = asyncHandler(async (req, res) => {
  const company = req.user.company;
  const now = new Date();
  const months = lastSixMonths(now);
  const [statusRows, sportRows, joinRows, subbed] = await Promise.all([
    Student.aggregate([{ $match: { company } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Student.aggregate([
      { $match: { company, status: "active" } },
      { $group: { _id: "$sport", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 8 },
    ]),
    Student.aggregate([
      { $match: { company, enrollmentDate: { $gte: months[0].start } } },
      { $group: { _id: { y: { $year: "$enrollmentDate" }, m: { $month: "$enrollmentDate" } }, n: { $sum: 1 } } },
    ]),
    StudentSubscription.distinct("student", {
      company,
      status: { $in: ["active", "pending_renewal"] },
    }),
  ]);
  const byStatus = Object.fromEntries(statusRows.map((r) => [r._id, r.n]));
  const total = statusRows.reduce((s, r) => s + r.n, 0);
  const active = byStatus.active || 0;
  const joinMap = Object.fromEntries(joinRows.map((r) => [`${r._id.y}-${r._id.m}`, r.n]));
  const joins = months.map((m) => ({
    label: m.label,
    value: joinMap[`${m.start.getFullYear()}-${m.start.getMonth() + 1}`] || 0,
  }));
  res.json({
    success: true,
    data: {
      total,
      active,
      inactive: byStatus.inactive || 0,
      onHold: byStatus.on_hold || 0,
      withoutSubscription: Math.max(0, active - subbed.length),
      newThisMonth: joins[joins.length - 1].value,
      bySport: sportRows.map((r) => ({ name: r._id || "Other", value: r.n })),
      joins,
    },
  });
});

// GET /api/insights/plans — subscribers per plan and revenue mix.
const planInsights = asyncHandler(async (req, res) => {
  const rows = await StudentSubscription.aggregate([
    { $match: { company: req.user.company, status: { $in: ["active", "pending_renewal"] } } },
    { $group: { _id: "$planName", subscribers: { $sum: 1 }, revenue: { $sum: "$amount" } } },
    { $sort: { subscribers: -1 } },
    { $limit: 8 },
  ]);
  const totalSubs = rows.reduce((s, r) => s + r.subscribers, 0);
  res.json({
    success: true,
    data: {
      totalSubscribers: totalSubs,
      plans: rows.map((r) => ({ name: r._id, subscribers: r.subscribers, revenue: r.revenue })),
    },
  });
});

// GET /api/insights/expenses — 6-month spend trend and category split.
const expenseInsights = asyncHandler(async (req, res) => {
  const company = req.user.company;
  const months = lastSixMonths();
  const [trendRows, catRows] = await Promise.all([
    Expense.aggregate([
      { $match: { company, date: { $gte: months[0].start } } },
      { $group: { _id: { y: { $year: "$date" }, m: { $month: "$date" } }, total: { $sum: "$amount" } } },
    ]),
    Expense.aggregate([
      { $match: { company, date: { $gte: months[5].start, $lt: months[5].end } } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ]),
  ]);
  const map = Object.fromEntries(trendRows.map((r) => [`${r._id.y}-${r._id.m}`, r.total]));
  res.json({
    success: true,
    data: {
      trend: months.map((m) => ({
        label: m.label,
        value: Math.round((map[`${m.start.getFullYear()}-${m.start.getMonth() + 1}`] || 0) / 1000),
      })),
      categories: catRows.map((r) => ({ name: r._id, value: Math.round(r.total / 1000) })),
    },
  });
});

// GET /api/insights/student-attendance — 14-day rate and students needing attention.
const studentAttendanceInsights = asyncHandler(async (req, res) => {
  const company = req.user.company;
  const since = new Date();
  since.setDate(since.getDate() - 30);
  since.setHours(0, 0, 0, 0);
  const rows = await StudentAttendance.aggregate([
    { $match: { company, date: { $gte: since } } },
    {
      $group: {
        _id: "$student",
        marked: { $sum: 1 },
        attended: { $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] } },
      },
    },
    { $match: { marked: { $gte: 4 } } },
    { $addFields: { rate: { $multiply: [{ $divide: ["$attended", "$marked"] }, 100] } } },
    { $sort: { rate: 1 } },
    { $limit: 5 },
    { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "s" } },
    { $unwind: "$s" },
  ]);
  const daily = await StudentAttendance.aggregate([
    { $match: { company, date: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        marked: { $sum: 1 },
        attended: { $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  res.json({
    success: true,
    data: {
      lowAttendance: rows.map((r) => ({
        name: `${r.s.firstName} ${r.s.lastName || ""}`.trim(),
        sport: r.s.sport,
        rate: Math.round(r.rate),
      })),
      trend: daily.slice(-14).map((d) => ({
        label: d._id.slice(5),
        value: d.marked ? Math.round((d.attended / d.marked) * 100) : 0,
      })),
    },
  });
});

module.exports = {
  studentInsights,
  planInsights,
  expenseInsights,
  studentAttendanceInsights,
};
