// WhatsApp credits. 1 credit ~ Rs 1. Rates/packs/bonus are PLACEHOLDERS - edit here, no other code changes.
// Balances are stored as integers of 1/UNIT credit so 0.2-credit messages never drift (0.1 + 0.2 != 0.3).
module.exports = {
  UNIT: 100,
  DEFAULT_RATE: 0.2, // credits per message; every NestAcademy template is UTILITY today
  RATES: {}, // per-template override, e.g. { neshr_salary_paid: 0.3 }
  GST_PCT: 18,
  // price = what the tenant pays before GST, credits = what they get
  PACKS: [
    { id: "p500", price: 500, credits: 500 },
    { id: "p1000", price: 1000, credits: 1000 },
    { id: "p2500", price: 2500, credits: 2625 },
    { id: "p5000", price: 5000, credits: 5500 },
  ],
  LOW_BALANCE_CREDITS: 50,
  DAILY_CAP: 5000, // messages per academy per day (every student alert is a message); a loop/bug can't drain a wallet
  BONUS_DAYS: 90,
  // free credits on a paid subscription: 10% of what was paid, to the nearest 50, between 0 and 1500
  bonusFor: (subscription) => Math.min(1500, Math.floor(((subscription.amountPaid || 0) * 0.1) / 50) * 50),
};
