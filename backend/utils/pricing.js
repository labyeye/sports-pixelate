// Two-tier plan, priced per student per year:
//   standard — ₹150/student/year, no WhatsApp notifications
//   whatsapp — ₹300/student/year, includes WhatsApp notifications
// Monthly is just the yearly price prorated over 12 months (no separate
// monthly-billing discount).
const RATE_PER_STUDENT = {
  standard: 150,
  whatsapp: 300,
};

const TIERS = Object.keys(RATE_PER_STUDENT);

// `offer` is an optional OfferCode document. Only flat_rate and percent_off
// affect price here — bonus_months affects the renewal date, not the amount
// due, and is applied separately by the caller.
function calculatePricing(studentCount, tier = "standard", offer = null) {
  const baseRate = RATE_PER_STUDENT[tier];
  if (!baseRate) {
    throw new Error(
      `Invalid tier "${tier}". Must be one of: ${TIERS.join(", ")}`,
    );
  }

  let rate = baseRate;
  if (offer && offer.discountType === "flat_rate" && offer.flatRate) {
    rate = offer.flatRate;
  }

  let yearlyPrice = studentCount * rate;
  if (offer && offer.discountType === "percent_off" && offer.percentOff) {
    yearlyPrice = Math.round(yearlyPrice * (1 - offer.percentOff / 100));
  }
  const monthlyPrice = Math.round(yearlyPrice / 12);

  return {
    tier,
    ratePerStudent: rate,
    monthlyPrice,
    yearlyPrice,
  };
}

module.exports = { RATE_PER_STUDENT, TIERS, calculatePricing };
