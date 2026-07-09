const asyncHandler = require("express-async-handler");
const Booking = require("../models/Booking");
const Facility = require("../models/Facility");
const razorpayService = require("../services/razorpayService");

function toDateOnly(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Simple "HH:MM" overlap check for two time ranges on the same day/facility.
function timesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// owner/staff: every booking. parent: only bookings for their children (or made by them).
const getBookings = asyncHandler(async (req, res) => {
  const { facility, date } = req.query;
  const filter = { company: req.user.company };
  if (req.user.role === "parent") {
    filter.$or = [
      { student: { $in: req.user.children || [] } },
      { bookedBy: req.user._id },
    ];
  }
  if (facility) filter.facility = facility;
  if (date) filter.date = toDateOnly(date);

  const bookings = await Booking.find(filter)
    .populate("facility", "name type sport hourlyFee")
    .populate("student", "firstName lastName")
    .populate("bookedBy", "name")
    .sort({ date: -1, startTime: 1 });

  res.json({ success: true, data: bookings });
});

// Creates a booking. If the facility has an hourlyFee, this returns a Razorpay
// order the client must pay before the booking is treated as confirmed+paid —
// otherwise it's confirmed immediately (free booking).
const createBooking = asyncHandler(async (req, res) => {
  const { facilityId, studentId, date, startTime, endTime, notes } = req.body;
  if (!facilityId || !date || !startTime || !endTime) {
    res.status(400);
    throw new Error("facilityId, date, startTime and endTime are required");
  }
  if (startTime >= endTime) {
    res.status(400);
    throw new Error("startTime must be before endTime");
  }

  const facility = await Facility.findOne({ _id: facilityId, company: req.user.company, active: true });
  if (!facility) {
    res.status(404);
    throw new Error("Facility not found");
  }

  const d = toDateOnly(date);
  const sameDayBookings = await Booking.find({
    facility: facilityId,
    date: d,
    status: "confirmed",
  });
  const clash = sameDayBookings.some((b) => timesOverlap(startTime, endTime, b.startTime, b.endTime));
  if (clash) {
    res.status(409);
    throw new Error("This time slot is already booked");
  }

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const hours = (endH * 60 + endM - (startH * 60 + startM)) / 60;
  const fee = Math.max(0, Math.round(facility.hourlyFee * hours));

  const booking = await Booking.create({
    company: req.user.company,
    facility: facilityId,
    student: studentId || undefined,
    bookedBy: req.user._id,
    date: d,
    startTime,
    endTime,
    fee,
    notes,
    paymentStatus: fee > 0 ? "pending" : "not_required",
  });

  if (fee === 0) {
    return res.status(201).json({ success: true, data: booking });
  }

  const order = await razorpayService.createOrder({
    amount: fee,
    receipt: `book_${Date.now()}`,
    notes: { bookingId: booking._id.toString() },
  });
  booking.razorpayOrderId = order.orderId;
  await booking.save();

  res.status(201).json({
    success: true,
    data: booking,
    payment: { orderId: order.orderId, keyId: order.keyId, amount: fee, currency: "INR" },
  });
});

const verifyBookingPayment = asyncHandler(async (req, res) => {
  const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    res.status(400);
    throw new Error("razorpayOrderId, razorpayPaymentId and razorpaySignature are required");
  }
  const isValid = razorpayService.verifySignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });
  if (!isValid) {
    res.status(400);
    throw new Error("Payment verification failed. Invalid signature.");
  }

  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, razorpayOrderId, company: req.user.company },
    { paymentStatus: "completed", razorpayPaymentId },
    { new: true },
  );
  if (!booking) {
    res.status(404);
    throw new Error("Booking not found");
  }
  res.json({ success: true, data: booking });
});

const cancelBooking = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, company: req.user.company };
  if (req.user.role === "parent") {
    filter.$or = [{ student: { $in: req.user.children || [] } }, { bookedBy: req.user._id }];
  }
  const booking = await Booking.findOneAndUpdate(filter, { status: "cancelled" }, { new: true });
  if (!booking) {
    res.status(404);
    throw new Error("Booking not found");
  }
  res.json({ success: true, data: booking });
});

module.exports = { getBookings, createBooking, verifyBookingPayment, cancelBooking };
