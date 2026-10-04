const asyncHandler = require("express-async-handler");
const service = require("../services/paymentLinkService");

// ---- public (no login): the link's token is the credential ----------------

const getLink = asyncHandler(async (req, res) => {
  const data = await service.getPublicDetails(req.params.token);
  if (!data) {
    res.status(404);
    throw new Error("Payment link not found");
  }
  res.json({ success: true, data });
});

const startOrder = asyncHandler(async (req, res) => {
  const result = await service.startPayment(req.params.token);
  if (result.error) {
    res.status(result.code);
    throw new Error(result.error);
  }
  res.json({ success: true, data: result.data });
});

const verify = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  const result = await service.confirmPayment(req.params.token, {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });
  if (result.error) {
    res.status(result.code);
    throw new Error(result.error);
  }
  res.json({ success: true, data: result.data });
});

// ---- owner: send this month's links right now (on top of the schedule) ----

const sendNow = asyncHandler(async (req, res) => {
  const links = await service.ensureMonthlyLinks(req.user.company);
  const sent = await service.sendPendingLinks(req.user.company);
  res.json({ success: true, data: { ...links, ...sent } });
});

module.exports = { getLink, startOrder, verify, sendNow };
