const express = require("express");
const {
  getSubscriptions,
  createOrder,
  verifyPayment,
  cancelSubscription,
} = require("../controllers/subscriptionController");
const { protect } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getSubscriptions);
router.post("/create-order", protect, createOrder);
router.post("/verify-payment", protect, verifyPayment);
router.post("/:id/cancel", protect, cancelSubscription);

module.exports = router;
