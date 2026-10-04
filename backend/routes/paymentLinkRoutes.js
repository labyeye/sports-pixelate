const express = require("express");
const { sendNow } = require("../controllers/paymentLinkController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.post(
  "/send-now",
  protect,
  authorize("super_admin", "hr_manager"),
  sendNow,
);

module.exports = router;
