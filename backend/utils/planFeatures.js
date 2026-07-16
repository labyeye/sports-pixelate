const Company = require("../models/Company");
const Subscription = require("../models/Subscription");

// Two billing tiers (see utils/pricing.js): "standard" (₹150/student/year)
// and "whatsapp" (₹300/student/year). WhatsApp notifications are the only
// thing gated on tier — every other feature is available on both.
const FEATURES_BY_TIER = {
  standard: {
    mobileApp: true,
    payroll: true,
    performanceReviews: true,
    exitManagement: true,
    whatsapp: false,
    twoFactor: true,
    auditLog: true,
    recruitment: true,
  },
  whatsapp: {
    mobileApp: true,
    payroll: true,
    performanceReviews: true,
    exitManagement: true,
    whatsapp: true,
    twoFactor: true,
    auditLog: true,
    recruitment: true,
  },
};

// No feature at all — used when a company has no active subscription.
const NO_FEATURES = Object.fromEntries(
  Object.keys(FEATURES_BY_TIER.standard).map((key) => [key, false]),
);

// Fail-closed: no company doc or no subscription at all → no features.
async function getCompanyFeatures(companyId) {
  const company = companyId
    ? await Company.findById(companyId).select("subscription")
    : null;
  const sub = company?.subscription
    ? await Subscription.findById(company.subscription).select("tier")
    : null;
  if (!sub) return NO_FEATURES;
  return FEATURES_BY_TIER[sub.tier] || FEATURES_BY_TIER.standard;
}

module.exports = { FEATURES_BY_TIER, getCompanyFeatures };
