const OfferCode = require("../models/OfferCode");

// Shared offer-code lookup/validation used by both the self-serve billing
// flow (billingController) and the CRM-initiated company creation flow
// (crmController). Throws a plain Error with a `.status` so callers outside
// asyncHandler (e.g. crmController, which isn't wrapped in express-async-handler)
// can still translate it into an HTTP response.
async function lookupAndValidateOffer(code) {
  const offer = await OfferCode.findOne({ code: code.toUpperCase().trim() });
  if (!offer || !offer.isActive) {
    const err = new Error("Invalid or expired offer code");
    err.status = 404;
    throw err;
  }
  if (offer.expiresAt && offer.expiresAt < new Date()) {
    const err = new Error("This offer code has expired");
    err.status = 400;
    throw err;
  }
  if (offer.usedCount >= offer.maxUses) {
    const err = new Error("This offer code has reached its usage limit");
    err.status = 400;
    throw err;
  }
  return offer;
}

module.exports = { lookupAndValidateOffer };
