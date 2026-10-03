const { getCompanyAccess } = require("./subscriptionStatus");

// One plan (see utils/pricing.js): every feature is included, except
// WhatsApp, which is the paid ₹50/user tier — it is only on when the academy
// actually bought it (`wantsWhatsapp`), and nothing works once the
// subscription has lapsed.
const FEATURE_KEYS = ["mobileApp", "whatsapp", "twoFactor", "auditLog"];

const NO_FEATURES = Object.fromEntries(FEATURE_KEYS.map((k) => [k, false]));

// Fail-closed: no company, no subscription or a lapsed one → no features.
async function getCompanyFeatures(companyId) {
  const access = await getCompanyAccess(companyId);
  if (!access.live) return NO_FEATURES;
  return {
    mobileApp: true,
    twoFactor: true,
    auditLog: true,
    whatsapp: access.whatsapp,
  };
}

module.exports = { FEATURE_KEYS, getCompanyFeatures };
