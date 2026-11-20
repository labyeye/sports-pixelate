// NestAcademy's three fixed yearly plans. The server (backend/utils/pricing.js) is what actually prices an
// order; these are only for showing the cards and a price preview.
export type PlanId = "starter" | "growth" | "unlimited";
export const GST_RATE = 18;
export const PLANS: {
  id: PlanId;
  name: string;
  maxStudents: number | null; // null = unlimited
  price: number;
}[] = [
  { id: "starter", name: "Starter", maxStudents: 50, price: 9999 },
  { id: "growth", name: "Growth", maxStudents: 100, price: 15999 },
  { id: "unlimited", name: "Unlimited", maxStudents: null, price: 25999 },
];

export const getPlan = (id?: string) => PLANS.find((p) => p.id === id);
export const planForStudents = (n: number) =>
  PLANS.find((p) => p.maxStudents === null || n <= p.maxStudents)!;
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Price of a plan after an offer code (flat_rate = fixed price, percent_off = % off), with GST. */
export function priceFor(planId: PlanId, offer?: any) {
  let subtotal = getPlan(planId)?.price ?? 0;
  if (offer?.discountType === "flat_rate" && offer.flatRate)
    subtotal = Math.min(subtotal, Math.round(offer.flatRate));
  if (offer?.discountType === "percent_off" && offer.percentOff)
    subtotal = Math.round(subtotal * (1 - offer.percentOff / 100));
  const gst = Math.round((subtotal * GST_RATE) / 100);
  return { subtotal, gst, total: subtotal + gst };
}
