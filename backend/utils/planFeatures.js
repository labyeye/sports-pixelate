const Company = require("../models/Company");

// Single plan (see utils/pricing.js): ₹30/student/month, every feature
// included (WhatsApp notifications too).
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

  return ALL_FEATURES;
}

module.exports = { ALL_FEATURES, getCompanyFeatures };
