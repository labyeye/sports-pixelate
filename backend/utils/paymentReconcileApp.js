const PendingOrder = require("../models/PendingOrder");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");

// What is specific to this product: which orders are ours, and how a paid order becomes a subscription.
module.exports = {
  ownsOrder: async (orderId) => !!((await PendingOrder.exists({ orderId })) || (await Subscription.exists({ razorpayOrderId: orderId }))),
  alreadyProvisioned: async (paymentId) => !!(await Invoice.exists({ razorpayPaymentId: paymentId })),
  provision: (ev) => require("../controllers/billingController").provisionRazorpay(ev),
};
