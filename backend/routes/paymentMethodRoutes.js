const express = require("express");
const {
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getDefaultPaymentMethod,
} = require("../controllers/paymentMethodController");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.use(protect, authorize("super_admin", "hr_manager"));

router.get("/", getPaymentMethods);

router.get("/default", getDefaultPaymentMethod);

router.post("/", addPaymentMethod);

router.patch("/:id", updatePaymentMethod);

router.delete("/:id", deletePaymentMethod);

module.exports = router;
