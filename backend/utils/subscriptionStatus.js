const Company = require("../models/Company");

// Days after a paid period ends during which the academy keeps working while
// the owner renews (matches what students get before being marked overdue).
const GRACE_DAYS = 7;
const CACHE_MS = 30 * 1000;
const cache = new Map(); // companyId -> { at, access }

// A company-level (NestPlay SaaS) subscription is "live" when it is
// active/pending_renewal, paid, the free trial hasn't ended, and — for paid
// plans — the renewal date (+ grace) hasn't passed.
function evaluate(sub, now = new Date()) {
  if (!sub) return { live: false, reason: "no_subscription", whatsapp: false };
  if (!["active", "pending_renewal"].includes(sub.status))
    return { live: false, reason: "inactive", whatsapp: false };
  if (sub.paymentStatus !== "completed")
    return { live: false, reason: "unpaid", whatsapp: false };
  if (sub.isTrial) {
    if (sub.trialEndDate && sub.trialEndDate < now)
      return { live: false, reason: "trial_expired", whatsapp: false };
  } else if (sub.renewalDate) {
    const cutoff = new Date(sub.renewalDate);
    cutoff.setDate(cutoff.getDate() + GRACE_DAYS);
    if (cutoff < now)
      return { live: false, reason: "expired", whatsapp: false };
  }
  return { live: true, reason: "ok", whatsapp: !!sub.wantsWhatsapp };
}

async function getCompanyAccess(companyId) {
  if (!companyId) return evaluate(null);
  const key = String(companyId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.access;

  const company = await Company.findById(companyId)
    .select("subscription")
    .populate(
      "subscription",
      "status paymentStatus isTrial trialEndDate renewalDate wantsWhatsapp",
    )
    .lean();
  const access = evaluate(company?.subscription);
  cache.set(key, { at: Date.now(), access });
  return access;
}

function invalidateCompanyAccess(companyId) {
  if (companyId) cache.delete(String(companyId));
}

module.exports = {
  GRACE_DAYS,
  evaluate,
  getCompanyAccess,
  invalidateCompanyAccess,
};
