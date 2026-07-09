const Company = require("../models/Company");
const Subscription = require("../models/Subscription");

const FEATURES_BY_TIER = {
  web: {
    mobileApp: false,
    payroll: true,
    performanceReviews: false,
    exitManagement: false,
    whatsapp: false,
    twoFactor: false,
    auditLog: false,
    recruitment: false,
  },
  web_mobile: {
    mobileApp: true,
    payroll: true,
    performanceReviews: true,
    exitManagement: true,
    whatsapp: false,
    twoFactor: false,
    auditLog: false,
    recruitment: false,
  },
  web_mobile_whatsapp: {
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

const TIER_RATES = {
  web: 500,
  web_mobile: 700,
  web_mobile_whatsapp: 800,
};

// Fail-closed: no company doc or no subscription at all → most restrictive
// feature set ("web"). But a subscription that predates the `tier` field
// (every tenant created before this field existed) should NOT be silently
// downgraded — those default to full access, matching the schema's own
// `default: "web_mobile_whatsapp"` for new documents.
async function getCompanyFeatures(companyId) {
  const company = companyId
    ? await Company.findById(companyId).select("subscription")
    : null;
  const sub = company?.subscription
    ? await Subscription.findById(company.subscription).select("tier")
    : null;
  if (!sub) return FEATURES_BY_TIER.web;
  const tier = sub.tier || "web_mobile_whatsapp";
  return FEATURES_BY_TIER[tier] || FEATURES_BY_TIER.web;
}

module.exports = { FEATURES_BY_TIER, TIER_RATES, getCompanyFeatures };
