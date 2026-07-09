const Razorpay = require("razorpay");
const crypto = require("crypto");

function getClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error(
      "Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env",
    );
  }
  return new Razorpay({ key_id, key_secret });
}

async function createOrder({ amount, currency = "INR", receipt, notes = {} }) {
  const client = getClient();
  const order = await client.orders.create({
    amount: Math.round(amount * 100),
    currency,
    receipt: receipt || `rcpt_${Date.now()}`,
    notes,
  });
  return {
    orderId: order.id,
    keyId: process.env.RAZORPAY_KEY_ID,
    amount,
    currency,
  };
}

function verifySignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_secret) throw new Error("RAZORPAY_KEY_SECRET not set");

  const expected = crypto
    .createHmac("sha256", key_secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return expected === razorpaySignature;
}

module.exports = { createOrder, verifySignature };
