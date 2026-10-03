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
  verifyRazorpayPayment,
  verifyHdfcPayment,
} = require("../controllers/billingController");

router.get("/plans", getPlans);
router.get("/subscription", protect, owner, getSubscription);
router.get("/invoices", protect, owner, getInvoices);
router.post("/validate-offer", protect, owner, validateOfferCode);
router.post("/create-order", protect, owner, createOrder);
router.post("/verify-payment", protect, owner, verifyPayment);
router.post("/verify-razorpay", protect, owner, verifyRazorpayPayment);
router.post("/verify-hdfc", protect, owner, verifyHdfcPayment);

module.exports = router;
