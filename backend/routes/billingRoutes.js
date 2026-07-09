const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getPlans,
  getSubscription,
  getInvoices,
  createOrder,
  validateOfferCode,
  verifyPayment,
  verifyRazorpayPayment,
  verifyHdfcPayment,
} = require("../controllers/billingController");

router.get("/plans", getPlans);
router.get("/subscription", protect, getSubscription);
router.get("/invoices", protect, getInvoices);
router.post("/validate-offer", protect, validateOfferCode);
router.post("/create-order", protect, createOrder);
router.post("/verify-payment", protect, verifyPayment);
router.post("/verify-razorpay", protect, verifyRazorpayPayment);
router.post("/verify-hdfc", protect, verifyHdfcPayment);

module.exports = router;
