const cron = require("node-cron");
const Lead = require("../models/Lead");
const { notifyUsers } = require("../services/inAppNotify");
const { acquire, withJobLock } = require("../utils/jobLock");
const logger = require("../utils/logger");

// Once a morning: each staff member with enquiries whose follow-up is due
// (today or earlier) gets one in-app reminder, so no admission goes cold.
async function runLeadFollowUps() {
  const endOfToday = new Date();
  endOfToday.setUTCHours(23, 59, 59, 999);
  const day = endOfToday.toISOString().slice(0, 10);

  const groups = await Lead.aggregate([
    {
      $match: {
        status: { $nin: ["converted", "lost"] },
        followUpDate: { $lte: endOfToday },
        assignedTo: { $exists: true },
      },
    },
    {
      $group: {
        _id: { company: "$company", user: "$assignedTo" },
        n: { $sum: 1 },
      },
    },
  ]);

  let sent = 0;
  for (const g of groups) {
    const key = `lead-followup:${g._id.company}:${g._id.user}:${day}`;
    if (!(await acquire(key, 24 * 3600 * 1000))) continue;
    await notifyUsers(g._id.company, [g._id.user], {
      type: "general",
      title: "Enquiry follow-ups due",
      message: `${g.n} enquir${g.n === 1 ? "y needs" : "ies need"} a follow-up today. Open Enquiries to call them.`,
    });
    sent++;
  }
  logger.info(`[Leads] ${sent} follow-up reminder(s) sent`);
}

function startLeadFollowUpJob() {
  const tick = () =>
    withJobLock("lead-followups", 30 * 60 * 1000, runLeadFollowUps).catch(
      (err) => {
        console.error("[Leads] job failed:", err.message);
        require("../utils/monitoring").captureError(err, {
          job: "lead-followups",
        });
      },
    );
  cron.schedule("30 3 * * *", tick, { timezone: "UTC" }); // ~09:00 IST
  logger.info("[Leads] Scheduled follow-up reminder job (daily)");
}

module.exports = { startLeadFollowUpJob, runLeadFollowUps };
