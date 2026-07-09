const { TIER_RATES } = require("./planFeatures");

const TIER_LABELS = {
  web: "Web",
  web_mobile: "Web + Mobile",
  web_mobile_whatsapp: "Web + Mobile + WhatsApp",
};

// Flat per-employee-per-year rate by tier. Monthly is just the yearly price
// prorated over 12 months — there's no separate monthly-billing discount.
function calculatePricing(employeeCount, tier) {
  const rate = TIER_RATES[tier];
  if (!rate) throw new Error(`Unknown tier: ${tier}`);

  const yearlyPrice = employeeCount * rate;
  const monthlyPrice = Math.round(yearlyPrice / 12);

  return {
    tier,
    tierLabel: TIER_LABELS[tier],
    ratePerEmployee: rate,
    monthlyPrice,
    yearlyPrice,
  };
}

module.exports = { TIER_RATES, TIER_LABELS, calculatePricing };
