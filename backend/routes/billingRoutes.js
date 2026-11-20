const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const owner = authorize("super_admin", "hr_manager");
const {
  getPlans,
  getSubscription,
  getInvoices,
  createOrder,
  validateOfferCode,
  verifyPayment,
  verifyCashfreePayment,
} = require("../controllers/billingController");

router.get("/plans", getPlans);
router.get("/subscription", protect, owner, getSubscription);
router.get("/invoices", protect, owner, getInvoices);
router.post("/validate-offer", protect, owner, validateOfferCode);
router.post("/create-order", protect, owner, createOrder);
router.post("/verify-payment", protect, owner, verifyPayment);
router.post("/verify-cashfree", protect, owner, verifyCashfreePayment);

// Hosted Cashfree checkout for the mobile app (opened in the phone's browser; the app then calls verify-payment).
const pageCsp =
  "default-src 'self'; script-src 'unsafe-inline' https://sdk.cashfree.com; style-src 'unsafe-inline'; " +
  "connect-src https://*.cashfree.com; frame-src https://*.cashfree.com; img-src data: https:";
const page = (body) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<body style="font-family:sans-serif;text-align:center;padding:48px 16px">${body}</body>`;
router.get("/cashfree-checkout", (req, res) => {
  const session = String(req.query.session || "");
  const mode = req.query.mode === "sandbox" ? "sandbox" : "production";
  if (!/^[A-Za-z0-9_-]+$/.test(session))
    return res.status(400).send("Bad request");
  res
    .set("Content-Security-Policy", pageCsp)
    .type("html")
    .send(
      page(
        `<p>Opening secure payment...</p><script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>` +
          `<script>Cashfree({mode:"${mode}"}).checkout({paymentSessionId:"${session}",redirectTarget:"_self"});</script>`,
      ),
    );
});
router.get("/cashfree-return", (req, res) =>
  res
    .set("Content-Security-Policy", pageCsp)
    .type("html")
    .send(
      page(
        "<h3>Payment submitted</h3><p>You can close this page and return to the NestAcademy app.</p>",
      ),
    ),
);

module.exports = router;
