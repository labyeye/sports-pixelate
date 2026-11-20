// NestAcademy pricing: three fixed yearly plans, picked by how many students the academy has.
// Staff/employees are not billed. WhatsApp is not a plan add-on any more: it runs on prepaid credits
// (config/credits.js). GST is added on top of the plan price, never absorbed into it.
const UNLIMITED = 1000000; // stored as maxStudents for the unlimited plan

const PLANS = [
  { id: "starter", name: "Starter", maxStudents: 50, price: 9999 },
  { id: "growth", name: "Growth", maxStudents: 100, price: 15999 },
  { id: "unlimited", name: "Unlimited", maxStudents: UNLIMITED, price: 25999 },
];

const GST_RATE = 18;
const PLAN_NAME = "NestAcademy";

const getPlan = (id) => PLANS.find((p) => p.id === id) || null;

/** Smallest plan that fits this many students. */
const planForStudents = (n) =>
  PLANS.find((p) => (Number(n) || 0) <= p.maxStudents) ||
  PLANS[PLANS.length - 1];

// `offer` is an optional OfferCode: flat_rate = fixed plan price (before GST), percent_off = % off the plan price.
// bonus_months only moves the renewal date and is applied by the caller.
function calculatePricing(planId, offer = null) {
  const plan = getPlan(planId);
  if (!plan) throw new Error("Unknown plan");
  let subtotal = plan.price;
  if (offer && offer.discountType === "flat_rate" && offer.flatRate)
    subtotal = Math.min(subtotal, Math.round(offer.flatRate));
  if (offer && offer.discountType === "percent_off" && offer.percentOff)
    subtotal = Math.round(subtotal * (1 - offer.percentOff / 100));
  const gstAmount = Math.round(subtotal * (GST_RATE / 100));
  return {
    plan: plan.id,
    planName: plan.name,
    maxStudents: plan.maxStudents,
    listPrice: plan.price,
    gstRate: GST_RATE,
    yearlySubtotal: subtotal,
    yearlyGstAmount: gstAmount,
    yearlyPrice: subtotal + gstAmount, // GST-inclusive: what is actually charged
  };
}

module.exports = {
  PLANS,
  UNLIMITED,
  GST_RATE,
  PLAN_NAME,
  getPlan,
  planForStudents,
  calculatePricing,
};
