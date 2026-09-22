const asyncHandler = require("express-async-handler");
const Booking = require("../models/Booking");
const Facility = require("../models/Facility");
const Setting = require("../models/Setting");
const paymentGatewayService = require("../services/paymentGatewayService");
const { safePagination, safeSort } = require("../middleware/validate");

const BOOKING_SORT_FIELDS = ["date", "fee", "createdAt"];

// Which gateway the club has connected in Settings, and that gateway's
// credentials — so payments land in the club's own account instead of the
// platform's. Falls back to Razorpay with no creds (platform env vars).
async function getCompanyPaymentCreds(company) {
  const setting = await Setting.findOne({ company }).select(
    "+razorpayKeySecret +cashfreeSecretKey +phonepeSaltKey +paytmMerchantKey",
  );
  const gateway = setting?.paymentGateway || "razorpay";
  let creds;
  if (gateway === "razorpay" && setting?.razorpayKeyId && setting?.razorpayKeySecret) {
    creds = { keyId: setting.razorpayKeyId, keySecret: setting.razorpayKeySecret };
  } else if (gateway === "cashfree" && setting?.cashfreeAppId && setting?.cashfreeSecretKey) {
    creds = { appId: setting.cashfreeAppId, secretKey: setting.cashfreeSecretKey };
  } else if (gateway === "phonepe" && setting?.phonepeMerchantId && setting?.phonepeSaltKey) {
    creds = {
      merchantId: setting.phonepeMerchantId,
      saltKey: setting.phonepeSaltKey,
      saltIndex: setting.phonepeSaltIndex,
    };
  } else if (gateway === "paytm" && setting?.paytmMerchantId && setting?.paytmMerchantKey) {
    creds = { merchantId: setting.paytmMerchantId, merchantKey: setting.paytmMerchantKey };
  }
  return { gateway, creds };
}

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
  const { facility, date, status } = req.query;
  const { page, limit, skip } = safePagination(req.query);
  const filter = { company: req.user.company };
  if (req.user.role === "parent") {
    filter.$or = [
      { student: { $in: req.user.children || [] } },
      { bookedBy: req.user._id },
    ];
  }
  if (facility) filter.facility = facility;
  if (date) filter.date = toDateOnly(date);
  if (status) filter.status = status;

  const sort = safeSort(req.query, BOOKING_SORT_FIELDS, {
    date: -1,
    startTime: 1,
  });
  const total = await Booking.countDocuments(filter);
  const bookings = await Booking.find(filter)
    .populate("facility", "name type sport hourlyFee")
    .populate("student", "firstName lastName")
    .populate("bookedBy", "name")
    .sort(sort)
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: bookings,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
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

  const facility = await Facility.findOne({
    _id: facilityId,
    company: req.user.company,
    active: true,
  });
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
  const clash = sameDayBookings.some((b) =>
    timesOverlap(startTime, endTime, b.startTime, b.endTime),
  );
  if (clash) {
    res.status(409);
    throw new Error("This time slot is already booked");
  }

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const hours = (endH * 60 + endM - (startH * 60 + startM)) / 60;
  const fee = Math.max(0, Math.round(facility.hourlyFee * hours));

  const { gateway, creds } =
    fee > 0
      ? await getCompanyPaymentCreds(req.user.company)
      : { gateway: null, creds: null };
  if (fee > 0 && !creds) {
    res.status(400);
    throw new Error(
      "This club hasn't set up online payments yet. Ask them to connect a payment gateway in Settings.",
    );
  }

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

  const orderId = `book_${Date.now()}_${booking._id.toString().slice(-6)}`;
  const order = await paymentGatewayService.createOrder(gateway, creds, {
    amount: fee,
    orderId,
    customer: {
      id: req.user._id.toString(),
      name: req.user.name || "Guest",
      phone: req.user.phone,
      email: req.user.email,
    },
    returnUrl: `${process.env.FRONTEND_URL || "https://sports.pixelatenest.com"}/payment-return?type=booking&bookingId=${booking._id}&orderId=${orderId}`,
  });
  booking.razorpayOrderId = order.orderId;
  booking.paymentGateway = gateway;
  await booking.save();

  res.status(201).json({
    success: true,
    data: booking,
    payment: {
      gateway: order.gateway,
      checkoutMode: order.checkoutMode,
      orderId: order.orderId,
      keyId: order.keyId,
      appId: order.appId,
      paymentSessionId: order.paymentSessionId,
      checkoutUrl: order.checkoutUrl,
      redirectUrl: order.redirectUrl,
      redirectFields: order.redirectFields,
      amount: fee,
      currency: "INR",
    },
  });
});

// See subscriptionController.verifyPayment for why this re-checks with the
// gateway itself (modal callback or redirect-return poll) instead of
// trusting the client, and why it's idempotent.
const verifyBookingPayment = asyncHandler(async (req, res) => {
  const bookingId = req.body.bookingId;
  const orderId = req.body.orderId || req.body.razorpayOrderId;
  const { razorpayPaymentId, razorpaySignature } = req.body;
  if (!bookingId || !orderId) {
    res.status(400);
    throw new Error("bookingId and orderId are required");
  }

  const existing = await Booking.findOne({
    _id: bookingId,
    razorpayOrderId: orderId,
    company: req.user.company,
  });
  if (!existing) {
    res.status(404);
    throw new Error("Booking not found");
  }
  if (existing.paymentStatus === "completed") {
    res.json({ success: true, data: existing });
    return;
  }

  const gateway = existing.paymentGateway || "razorpay";
  const { creds } = await getCompanyPaymentCreds(req.user.company);
  const result = await paymentGatewayService.confirmPayment(
    gateway,
    creds,
    orderId,
    { razorpayOrderId: orderId, razorpayPaymentId, razorpaySignature },
  );
  if (!result.isSuccess) {
    res.status(400);
    throw new Error("Payment verification failed.");
  }

  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, razorpayOrderId: orderId, company: req.user.company },
    {
      paymentStatus: "completed",
      razorpayPaymentId: razorpayPaymentId || orderId,
    },
    { new: true },
  );
  res.json({ success: true, data: booking });
});

const cancelBooking = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, company: req.user.company };
  if (req.user.role === "parent") {
    filter.$or = [
      { student: { $in: req.user.children || [] } },
      { bookedBy: req.user._id },
    ];
  }
  const booking = await Booking.findOneAndUpdate(
    filter,
    { status: "cancelled" },
    { new: true },
  );
  if (!booking) {
    res.status(404);
    throw new Error("Booking not found");
  }
  res.json({ success: true, data: booking });
});

module.exports = {
  getBookings,
  createBooking,
  verifyBookingPayment,
  cancelBooking,
};
