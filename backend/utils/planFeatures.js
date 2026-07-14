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

// Billing is now a single flat plan (₹150/student/year) — every company with
// a real subscription gets the full feature set. `FEATURES_BY_TIER` and the
// `tier` field on Subscription are kept only for the superadmin override
// endpoint (adminController.updateCompanyTier) and historical records; they
// no longer gate what a tenant can access.
// Fail-closed: no company doc or no subscription at all → most restrictive
// feature set ("web").
async function getCompanyFeatures(companyId) {
  const company = companyId
    ? await Company.findById(companyId).select("subscription")
    : null;
  const sub = company?.subscription
    ? await Subscription.findById(company.subscription).select("_id")
    : null;
  return sub ? FEATURES_BY_TIER.web_mobile_whatsapp : FEATURES_BY_TIER.web;
}

module.exports = { FEATURES_BY_TIER, getCompanyFeatures };
