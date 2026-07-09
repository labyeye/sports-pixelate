const express = require("express");
const {
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getDefaultPaymentMethod,
} = require("../controllers/paymentMethodController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.get("/", getPaymentMethods);

router.get("/default", getDefaultPaymentMethod);

router.post("/", addPaymentMethod);

router.patch("/:id", updatePaymentMethod);

router.delete("/:id", deletePaymentMethod);

module.exports = router;
