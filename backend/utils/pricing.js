// Single plan, priced per (student + employee) per year: ₹150/unit/year
// without WhatsApp notifications, ₹300/unit/year with WhatsApp notifications
// included. Monthly is just the yearly price prorated over 12 months (no
// separate monthly-billing discount).
const RATE_STANDARD = 150;
const RATE_WHATSAPP = 300;

// `offer` is an optional OfferCode document. Only flat_rate and percent_off
// affect price here — bonus_months affects the renewal date, not the amount
// due, and is applied separately by the caller.
function calculatePricing(studentCount, employeeCount, wantsWhatsapp, offer = null) {
  const totalUnits = studentCount + employeeCount;

  let rate = wantsWhatsapp ? RATE_WHATSAPP : RATE_STANDARD;
  if (offer && offer.discountType === "flat_rate" && offer.flatRate) {
    rate = offer.flatRate;
  }

  let yearlyPrice = totalUnits * rate;
  if (offer && offer.discountType === "percent_off" && offer.percentOff) {
    yearlyPrice = Math.round(yearlyPrice * (1 - offer.percentOff / 100));
  }
  const monthlyPrice = Math.round(yearlyPrice / 12);

  return {
    ratePerUnit: rate,
    monthlyPrice,
    yearlyPrice,
  };
}

module.exports = { RATE_STANDARD, RATE_WHATSAPP, calculatePricing };
