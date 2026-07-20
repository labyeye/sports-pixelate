const Company = require("../models/Company");
const Subscription = require("../models/Subscription");

// Single plan (see utils/pricing.js): ₹150/person/year, every feature
// included except WhatsApp notifications, which are ₹300/person/year and
// gated by the subscription's `wantsWhatsapp` flag.
const ALL_FEATURES = {
  mobileApp: true,
  payroll: true,
  performanceReviews: true,
  exitManagement: true,
  whatsapp: true,
  twoFactor: true,
  auditLog: true,
  recruitment: true,
};

// No feature at all — used when a company has no active subscription.
const NO_FEATURES = Object.fromEntries(
  Object.keys(ALL_FEATURES).map((key) => [key, false]),
);

// Fail-closed: no company doc or no subscription at all → no features.
async function getCompanyFeatures(companyId) {
  const company = companyId
    ? await Company.findById(companyId).select("subscription")
    : null;
  if (!company?.subscription) return NO_FEATURES;

  const subscription = await Subscription.findById(company.subscription).select(
    "wantsWhatsapp",
  );

  return { ...ALL_FEATURES, whatsapp: !!subscription?.wantsWhatsapp };
}

module.exports = { ALL_FEATURES, getCompanyFeatures };
