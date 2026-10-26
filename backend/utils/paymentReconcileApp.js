const PendingOrder = require("../models/PendingOrder");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const CreditTopup = require("../models/CreditTopup");

// What is specific to this product: which orders are ours, and how a paid order becomes a subscription.
module.exports = {
  ownsOrder: async (orderId) => !!((await PendingOrder.exists({ orderId })) || (await Subscription.exists({ razorpayOrderId: orderId })) || (await CreditTopup.exists({ orderId }))),
  alreadyProvisioned: async (paymentId) => !!((await Invoice.exists({ razorpayPaymentId: paymentId })) || (await CreditTopup.exists({ paymentId }))),
  provision: async (ev) => {
    if (await CreditTopup.exists({ orderId: ev.orderId })) return require("../services/creditsService").completeTopup(ev);
    return require("../controllers/billingController").provisionRazorpay(ev);
  },
};
