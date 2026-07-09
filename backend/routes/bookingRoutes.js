const express = require("express");
const {
  getBookings,
  createBooking,
  verifyBookingPayment,
  cancelBooking,
} = require("../controllers/bookingController");
const { protect } = require("../middleware/auth");
const router = express.Router();

// Anyone logged in (owner/staff/parent) can browse and create bookings —
// visibility/ownership is scoped inside the controller.
router.get("/", protect, getBookings);
router.post("/", protect, createBooking);
router.post("/verify-payment", protect, verifyBookingPayment);
router.post("/:id/cancel", protect, cancelBooking);

module.exports = router;
