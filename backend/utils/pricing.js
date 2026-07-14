// Single flat plan now — no more per-tier rates. ₹150 per student per year;
// monthly is just the yearly price prorated over 12 months (no separate
// monthly-billing discount).
const RATE_PER_STUDENT = 150;

function calculatePricing(studentCount) {
  const yearlyPrice = studentCount * RATE_PER_STUDENT;
  const monthlyPrice = Math.round(yearlyPrice / 12);

  return {
    ratePerStudent: RATE_PER_STUDENT,
    monthlyPrice,
    yearlyPrice,
  };
}

module.exports = { RATE_PER_STUDENT, calculatePricing };
