const express = require("express");
const {
  getSubscriptions,
  createOrder,
  verifyPayment,
  createQrRenewalRequest,
  confirmQrPayment,
  cancelSubscription,
} = require("../controllers/subscriptionController");
const { protect } = require("../middleware/auth");
const { uploadPaymentScreenshot } = require("../middleware/upload");
const router = express.Router();

router.get("/", protect, getSubscriptions);
router.post("/create-order", protect, createOrder);
router.post("/verify-payment", protect, verifyPayment);
router.post(
  "/qr-renewal",
  protect,
  uploadPaymentScreenshot,
  createQrRenewalRequest,
);
router.post("/:id/confirm-qr-payment", protect, confirmQrPayment);
router.post("/:id/cancel", protect, cancelSubscription);

module.exports = router;
