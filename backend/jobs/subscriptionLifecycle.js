const cron = require("node-cron");
const StudentSubscription = require("../models/StudentSubscription");
const { notifyParentsOfStudent, notifyOwners } = require("../services/inAppNotify");
const { acquire, withJobLock } = require("../utils/jobLock");
const logger = require("../utils/logger");

const DAY = 86400000;
// Days relative to the renewal date at which a reminder goes out
// (negative = before, positive = overdue).
const REMINDER_STAGES = [-7, -3, -1, 0, 1, 3, 7, 14, 21, 30];

function startOfTodayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Largest stage already reached for a renewal that is `daysFromRenewal` days
// past due (negative = still upcoming).
function currentStage(daysFromRenewal) {
  let stage = null;
  for (const s of REMINDER_STAGES) if (daysFromRenewal >= s) stage = s;
  return stage;
}

function describe(sub, stage) {
  const name = `${sub.student.firstName} ${sub.student.lastName}`.trim();
  const due = new Date(sub.renewalDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const balance = Math.max(0, (sub.amount || 0) - (sub.amountPaid || 0));
  const amount = balance > 0 ? balance : sub.amount || 0;
  if (stage < 0)
    return {
      title: "Fee due soon",
      message: `${name}'s ${sub.planName} plan renews on ${due}. Amount: ₹${amount.toLocaleString("en-IN")}.`,
    };
  if (stage === 0)
    return {
      title: "Fee due today",
      message: `${name}'s ${sub.planName} plan renews today (${due}). Amount: ₹${amount.toLocaleString("en-IN")}.`,
    };
  return {
    title: "Fee overdue",
    message: `${name}'s ${sub.planName} plan was due on ${due} — ${stage} day${stage === 1 ? "" : "s"} overdue. Amount: ₹${amount.toLocaleString("en-IN")}.`,
  };
}

// 1) active plans past their renewal date become `pending_renewal` (overdue),
//    which is what the dashboard's "Subscription Renewals" panel and the
//    outstanding-dues report key off; 2) parents get in-app reminders at fixed
//    stages; 3) owners get one daily digest. Safe to run repeatedly.
async function runSubscriptionLifecycle() {
  const today = startOfTodayUTC();

  const flipped = await StudentSubscription.updateMany(
    { status: "active", renewalDate: { $lt: today } },
    { $set: { status: "pending_renewal" } },
  );

  const horizon = new Date(today.getTime() + 8 * DAY);
  const subs = await StudentSubscription.find({
    status: { $in: ["active", "pending_renewal"] },
    renewalDate: { $lte: horizon },
  }).populate("student", "firstName lastName status");

  const digest = new Map(); // companyId -> { upcoming, overdue }
  let sent = 0;
  for (const sub of subs) {
    if (!sub.student || sub.student.status === "inactive") continue;
    const renewal = new Date(sub.renewalDate);
    renewal.setUTCHours(0, 0, 0, 0);
    const days = Math.round((today - renewal) / DAY);
    const stage = currentStage(days);
    if (stage === null) continue;

    const c = String(sub.company);
    const d = digest.get(c) || { upcoming: 0, overdue: 0 };
    if (days > 0) d.overdue++;
    else d.upcoming++;
    digest.set(c, d);

    const key = `${renewal.toISOString().slice(0, 10)}:${stage}`;
    if ((sub.remindersSent || []).includes(key)) continue;
    // Claim first so two instances can't both notify for the same stage.
    const claimed = await StudentSubscription.updateOne(
      { _id: sub._id, remindersSent: { $ne: key } },
      { $push: { remindersSent: key } },
    );
    if (!claimed.modifiedCount) continue;

    const { title, message } = describe(sub, stage);
    await notifyParentsOfStudent(sub.student._id, sub.company, {
      type: "fee_reminder",
      title,
      message,
      student: sub.student._id,
    });
    sent++;
  }

  for (const [companyId, d] of digest) {
    const day = today.toISOString().slice(0, 10);
    if (!(await acquire(`fee-digest:${companyId}:${day}`, DAY))) continue;
    await notifyOwners(companyId, {
      type: "fee_reminder",
      title: "Fees to collect",
      message: `${d.overdue} overdue and ${d.upcoming} due within 7 days. Open Subscriptions to follow up.`,
    });
  }

  logger.info(
    `[Subscriptions] ${flipped.modifiedCount || 0} marked overdue, ${sent} reminder(s) sent`,
  );
}

function startSubscriptionLifecycleJob() {
  const tick = () =>
    withJobLock("subscription-lifecycle", 55 * 60 * 1000, runSubscriptionLifecycle).catch(
      (err) => {
        console.error("[Subscriptions] job failed:", err.message);
        require("../utils/monitoring").captureError(err, { job: "subscription-lifecycle" });
      },
    );
  // Hourly; the lock keeps it to one run per hour across instances.
  cron.schedule("5 * * * *", tick, { timezone: "UTC" });
  setTimeout(tick, 15000);
  logger.info("[Subscriptions] Scheduled lifecycle job (hourly)");
}

module.exports = {
  startSubscriptionLifecycleJob,
  runSubscriptionLifecycle,
  currentStage,
  REMINDER_STAGES,
};
