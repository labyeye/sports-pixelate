const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  getLink,
  startOrder,
  verify,
} = require("../controllers/paymentLinkController");
const router = express.Router();

// Public endpoints (the link token is the credential), so keep them tight.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, message: "Too many attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/:token", limiter, getLink);
router.post("/:token/order", limiter, startOrder);
router.post("/:token/verify", limiter, verify);

module.exports = router;
