const express = require("express");
const {
  getSubscriptions,
  createOrder,
  verifyPayment,
  createQrRenewalRequest,
  submitInstallmentPayment,
  verifyQrPayment,
  rejectQrPayment,
  getPaymentReceipt,
  cancelSubscription,
  bulkImportSubscriptions,
} = require("../controllers/subscriptionController");
const { protect, authorize } = require("../middleware/auth");
const { uploadPaymentScreenshot } = require("../middleware/upload");
const router = express.Router();

router.get("/", protect, getSubscriptions);
router.post(
  "/bulk-import",
  protect,
  authorize("super_admin", "hr_manager"),
  bulkImportSubscriptions,
);
router.post("/create-order", protect, createOrder);
router.post("/verify-payment", protect, verifyPayment);
router.post(
  "/qr-renewal",
  protect,
  uploadPaymentScreenshot,
  createQrRenewalRequest,
);
router.post(
  "/:id/payments",
  protect,
  uploadPaymentScreenshot,
  submitInstallmentPayment,
);
router.post("/:id/payments/:paymentId/verify", protect, verifyQrPayment);
router.post("/:id/payments/:paymentId/reject", protect, rejectQrPayment);
router.get("/:id/payments/:paymentId/receipt", protect, getPaymentReceipt);
router.post("/:id/cancel", protect, cancelSubscription);

module.exports = router;
