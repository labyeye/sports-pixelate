// Single plan, priced per (student + employee) per year: ₹150/unit/year
// without WhatsApp notifications, ₹300/unit/year with WhatsApp notifications
// included. Monthly is just the yearly price prorated over 12 months (no
// separate monthly-billing discount).
const RATE_STANDARD = 150;
const RATE_WHATSAPP = 300;

// GST is mandatory on every payment taken through this platform — 18% is
// added on top of the discounted subtotal, never absorbed into it.
const GST_RATE = 18;

// `offer` is an optional OfferCode document. Only flat_rate and percent_off
// affect price here — bonus_months affects the renewal date, not the amount
// due, and is applied separately by the caller.
function calculatePricing(
  studentCount,
  employeeCount,
  wantsWhatsapp,
  offer = null,
) {
  const totalUnits = studentCount + employeeCount;

  let rate = wantsWhatsapp ? RATE_WHATSAPP : RATE_STANDARD;
  if (offer && offer.discountType === "flat_rate" && offer.flatRate) {
    rate = offer.flatRate;
  }

  let yearlySubtotal = totalUnits * rate;
  if (offer && offer.discountType === "percent_off" && offer.percentOff) {
    yearlySubtotal = Math.round(yearlySubtotal * (1 - offer.percentOff / 100));
  }
  const yearlyGstAmount = Math.round(yearlySubtotal * (GST_RATE / 100));
  const yearlyPrice = yearlySubtotal + yearlyGstAmount;

  const monthlySubtotal = Math.round(yearlySubtotal / 12);
  const monthlyGstAmount = Math.round(monthlySubtotal * (GST_RATE / 100));
  const monthlyPrice = monthlySubtotal + monthlyGstAmount;

  return {
    ratePerUnit: rate,
    gstRate: GST_RATE,
    // GST-inclusive totals — these are what's actually charged/stored.
    monthlyPrice,
    yearlyPrice,
    // Breakdown for display (invoices, order summaries).
    monthlySubtotal,
    monthlyGstAmount,
    yearlySubtotal,
    yearlyGstAmount,
  };
}

module.exports = { RATE_STANDARD, RATE_WHATSAPP, GST_RATE, calculatePricing };
