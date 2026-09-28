// Single plan: ₹30 per student per month, every feature included (WhatsApp
// notifications too). Employees/coaches are not billed. Yearly is just 12x
// the monthly price (no yearly discount).
const RATE_PER_STUDENT = 30;

// GST is mandatory on every payment taken through this platform — 18% is
// added on top of the discounted subtotal, never absorbed into it.
const GST_RATE = 18;

// `offer` is an optional OfferCode document. Only flat_rate (₹/student/month)
// and percent_off affect price here — bonus_months affects the renewal date,
// not the amount due, and is applied separately by the caller.
// employeeCount/wantsWhatsapp are accepted for call-site compatibility but
// don't affect the price.
function calculatePricing(studentCount, _employeeCount, _wantsWhatsapp, offer = null) {
  let rate = RATE_PER_STUDENT;
  if (offer && offer.discountType === "flat_rate" && offer.flatRate) {
    rate = offer.flatRate;
  }

  let monthlySubtotal = studentCount * rate;
  if (offer && offer.discountType === "percent_off" && offer.percentOff) {
    monthlySubtotal = Math.round(monthlySubtotal * (1 - offer.percentOff / 100));
  }
  const monthlyGstAmount = Math.round(monthlySubtotal * (GST_RATE / 100));
  const monthlyPrice = monthlySubtotal + monthlyGstAmount;

  const yearlySubtotal = monthlySubtotal * 12;
  const yearlyGstAmount = Math.round(yearlySubtotal * (GST_RATE / 100));
  const yearlyPrice = yearlySubtotal + yearlyGstAmount;

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

module.exports = { RATE_PER_STUDENT, GST_RATE, calculatePricing };

if (require.main === module) {
  const assert = require("assert");
  const p = calculatePricing(100, 5, false);
  assert.deepStrictEqual(
    [p.monthlySubtotal, p.monthlyGstAmount, p.monthlyPrice, p.yearlyPrice],
    [3000, 540, 3540, 42480],
  );
  assert.strictEqual(calculatePricing(10, 0, false, { discountType: "flat_rate", flatRate: 20 }).monthlySubtotal, 200);
  assert.strictEqual(calculatePricing(10, 0, false, { discountType: "percent_off", percentOff: 50 }).monthlySubtotal, 150);
  console.log("pricing ok");
}
