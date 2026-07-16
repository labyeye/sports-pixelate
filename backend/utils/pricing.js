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

function calculatePricing(studentCount, tier = "standard") {
  const rate = RATE_PER_STUDENT[tier];
  if (!rate) {
    throw new Error(
      `Invalid tier "${tier}". Must be one of: ${TIERS.join(", ")}`,
    );
  }
  const yearlyPrice = studentCount * rate;
  const monthlyPrice = Math.round(yearlyPrice / 12);

  return {
    tier,
    ratePerStudent: rate,
    monthlyPrice,
    yearlyPrice,
  };
}

module.exports = { RATE_PER_STUDENT, TIERS, calculatePricing };
