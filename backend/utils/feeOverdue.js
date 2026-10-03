const DeductionRule = require("../models/DeductionRule");
const StudentSubscription = require("../models/StudentSubscription");
const Student = require("../models/Student");

const mongoose = require("mongoose");

const DAY_MS = 86400000;

// The rule is read on every attendance mark, so cache it briefly per company.
// Settings saves call invalidateFeeRule so the owner's change applies at once
// on this instance; other instances catch up within the TTL.
const RULE_TTL_MS = 30000;
const ruleCache = new Map();

async function getFeeRule(companyId) {
  const key = String(companyId);
  const hit = ruleCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.rule;
  const rule = await DeductionRule.findOne({ company: companyId })
    .select("feeLockEnabled feeDueDay feeGraceDays")
    .lean();
  ruleCache.set(key, { rule, expires: Date.now() + RULE_TTL_MS });
  return rule;
}

function invalidateFeeRule(companyId) {
  ruleCache.delete(String(companyId));
}

function utcDay(d) {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}

// Due date for a subscription's outstanding fee. With a configured due day it
// is that day of the subscription's start month (rolled to the next month if
// that day is before the start); otherwise the subscription's own date.
function dueDateFor(sub, feeDueDay, lapsedRenewal) {
  if (lapsedRenewal) {
    const r = new Date(sub.renewalDate);
    return feeDueDay
      ? Date.UTC(r.getUTCFullYear(), r.getUTCMonth(), feeDueDay)
      : utcDay(r);
  }
  const start = new Date(sub.startDate);
  if (!feeDueDay) return utcDay(start);
  let due = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), feeDueDay);
  if (due < utcDay(start)) {
    due = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, feeDueDay);
  }
  return due;
}

// Returns { enabled, overdue: Map<studentId, info> } for the given students.
// A student is overdue when their latest live subscription has an unpaid
// balance (nothing pending verification) or has lapsed unrenewed, and the due
// date passed more than the grace period ago.
async function getOverdueStudents(companyId, studentIds, now = new Date()) {
  const rule = await getFeeRule(companyId);
  const overdue = new Map();
  if (!rule?.feeLockEnabled || studentIds.length === 0) {
    return { enabled: false, overdue };
  }

  // One round trip, one row per student: the index serves the sort and the
  // group keeps only the newest live subscription.
  const toId = (id) => new mongoose.Types.ObjectId(String(id));
  const rows = await StudentSubscription.aggregate([
    {
      $match: {
        company: toId(companyId),
        student: { $in: studentIds.map(toId) },
        status: { $in: ["active", "pending_renewal"] },
      },
    },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$student", sub: { $first: "$$ROOT" } } },
    {
      $project: {
        "sub.planName": 1,
        "sub.amount": 1,
        "sub.amountPaid": 1,
        "sub.paymentStatus": 1,
        "sub.startDate": 1,
        "sub.renewalDate": 1,
        "sub.payments.status": 1,
      },
    },
  ]);
  const latest = new Map(rows.map((r) => [String(r._id), r.sub]));

  const today = utcDay(now);
  const grace = rule.feeGraceDays ?? 0;
  for (const [studentId, sub] of latest) {
    const unpaid = sub.paymentStatus !== "completed" && sub.amountPaid < sub.amount;
    const hasPendingPayment = (sub.payments || []).some((p) => p.status === "pending");
    const lapsed = !unpaid && new Date(sub.renewalDate).getTime() < today;
    if (!(unpaid && !hasPendingPayment) && !lapsed) continue;

    const dueDate = dueDateFor(sub, rule.feeDueDay, lapsed);
    const overdueDays = Math.floor((today - dueDate) / DAY_MS);
    if (overdueDays > grace) {
      overdue.set(studentId, {
        overdueDays,
        dueDate: new Date(dueDate),
        planName: sub.planName,
        amountDue: Math.max(0, sub.amount - (sub.amountPaid || 0)),
      });
    }
  }
  return { enabled: true, overdue };
}

function studentName(s) {
  return `${s.firstName || ""} ${s.lastName || ""}`.trim();
}

module.exports = { getOverdueStudents, studentName, invalidateFeeRule };
