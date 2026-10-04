const StudentSubscription = require("../models/StudentSubscription");

// Subscriptions that still count as billable (not cancelled/inactive).
const LIVE_STATUSES = ["active", "pending_renewal"];

// Fee numbers for one calendar month, grouped by the student's sport/group.
// - collected: verified payments whose verifiedAt falls inside the month
// - remaining: unpaid balance (amount - amountPaid) on live subscriptions that
//   are still pending/partial — owed regardless of which month they were billed
// Returns { collected, remaining, expected, bySport: { [sport]: {collected, remaining} } }.
async function getMonthlyFeeSummary(companyId, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const studentLookup = [
    {
      $lookup: {
        from: "students",
        localField: "student",
        foreignField: "_id",
        as: "stu",
      },
    },
    { $unwind: "$stu" },
  ];

  const [collectedRows, remainingRows] = await Promise.all([
    StudentSubscription.aggregate([
      { $match: { company: companyId, "payments.status": "verified" } },
      { $unwind: "$payments" },
      {
        $match: {
          "payments.status": "verified",
          "payments.verifiedAt": { $gte: start, $lt: end },
        },
      },
      ...studentLookup,
      { $group: { _id: "$stu.sport", total: { $sum: "$payments.amount" } } },
    ]),
    StudentSubscription.aggregate([
      {
        $match: {
          company: companyId,
          status: { $in: LIVE_STATUSES },
          paymentStatus: { $in: ["pending", "partial"] },
        },
      },
      ...studentLookup,
      {
        $group: {
          _id: "$stu.sport",
          total: {
            $sum: { $max: [{ $subtract: ["$amount", "$amountPaid"] }, 0] },
          },
        },
      },
    ]),
  ]);

  const bySport = {};
  const bucket = (sport) =>
    (bySport[sport || ""] = bySport[sport || ""] || {
      collected: 0,
      remaining: 0,
    });
  for (const r of collectedRows) bucket(r._id).collected = r.total;
  for (const r of remainingRows) bucket(r._id).remaining = r.total;

  const collected = collectedRows.reduce((s, r) => s + r.total, 0);
  const remaining = remainingRows.reduce((s, r) => s + r.total, 0);
  return { collected, remaining, expected: collected + remaining, bySport };
}

module.exports = { getMonthlyFeeSummary };
