const cron = require("node-cron");
const { withJobLock } = require("../utils/jobLock");
const DeductionRule = require("../models/DeductionRule");
const {
  istShift,
  ensureMonthlyLinks,
  sendPendingLinks,
} = require("../services/paymentLinkService");
const logger = require("../utils/logger");

// On each academy's chosen day of the month (at or after their chosen hour,
// IST) create that month's payment links and WhatsApp them. Safe to run often:
// links are unique per subscription+month, and only unsent ones go out, so a
// restart or retry never double-sends. Only the exact day sends — switching the
// feature on later in the month does not blast everyone.
async function runPaymentLinks() {
  const ist = istShift();
  const day = ist.getUTCDate();
  const hour = ist.getUTCHours();

  const rules = await DeductionRule.find({
    paymentLinkEnabled: true,
    paymentLinkDay: day,
    paymentLinkHour: { $lte: hour },
  })
    .select("company")
    .lean();

  for (const { company } of rules) {
    try {
      const links = await ensureMonthlyLinks(company);
      const sent = await sendPendingLinks(company);
      if (links.created || sent.sent || sent.failed) {
        logger.info(
          `[PaymentLinks] company=${company} created=${links.created} sent=${sent.sent} failed=${sent.failed} skipped=${sent.skipped} noGuardian=${links.noGuardian}`,
        );
      }
    } catch (err) {
      console.error(`[PaymentLinks] company=${company} failed:`, err);
    }
  }
}

function startPaymentLinksJob() {
  cron.schedule(
    "*/15 * * * *",
    () =>
      withJobLock("payment-links", 10 * 60 * 1000, runPaymentLinks).catch(
        (err) => {
          console.error("[PaymentLinks] failed:", err);
          require("../utils/monitoring").captureError(err, {
            job: "payment-links",
          });
        },
      ),
    { timezone: "UTC" },
  );
  logger.info("[PaymentLinks] Scheduled (every 15 minutes)");
}

module.exports = { startPaymentLinksJob, runPaymentLinks };
