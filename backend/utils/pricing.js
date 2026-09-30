// Two notification tiers, billed per user (students + employees combined,
// since both trigger and receive attendance notifications):
//   - In-app only:        ₹30/user/month
//   - In-app + WhatsApp:  ₹50/user/month
// Yearly is just 12x the monthly price (no yearly discount).
const RATE_INAPP = 30;
const RATE_WHATSAPP = 50;

// GST is mandatory on every payment taken through this platform — 18% is
// added on top of the discounted subtotal, never absorbed into it.
const GST_RATE = 18;

// `offer` is an optional OfferCode document. Only flat_rate (₹/user/month)
// and percent_off affect price here — bonus_months affects the renewal date,
// not the amount due, and is applied separately by the caller.
function calculatePricing(
  studentCount,
  employeeCount = 0,
  wantsWhatsapp = false,
  offer = null,
) {
  const totalUsers = (studentCount || 0) + (employeeCount || 0);
  let rate = wantsWhatsapp ? RATE_WHATSAPP : RATE_INAPP;
  if (offer && offer.discountType === "flat_rate" && offer.flatRate) {
    rate = offer.flatRate;
  }

  let monthlySubtotal = totalUsers * rate;
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

module.exports = { RATE_INAPP, RATE_WHATSAPP, GST_RATE, calculatePricing };

if (require.main === module) {
  const assert = require("assert");
  const p = calculatePricing(100, 5, false);
  assert.deepStrictEqual(
    [p.ratePerUnit, p.monthlySubtotal, p.monthlyGstAmount, p.monthlyPrice, p.yearlyPrice],
    [30, 3150, 567, 3717, 44604],
  );
  const wa = calculatePricing(100, 5, true);
  assert.deepStrictEqual(
    [wa.ratePerUnit, wa.monthlySubtotal, wa.monthlyPrice],
    [50, 5250, 6195],
  );
  assert.strictEqual(
    calculatePricing(10, 0, false, { discountType: "flat_rate", flatRate: 20 })
      .monthlySubtotal,
    200,
  );
  assert.strictEqual(
    calculatePricing(10, 0, false, { discountType: "percent_off", percentOff: 50 })
      .monthlySubtotal,
    150,
  );
  console.log("pricing ok");
}
