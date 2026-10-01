const asyncHandler = require("express-async-handler");
const Booking = require("../models/Booking");
const Facility = require("../models/Facility");
const InventoryItem = require("../models/InventoryItem");
const Student = require("../models/Student");
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


// Restores stock for gear on a booking that hasn't been returned yet.
// `onlyIds` limits it to specific booking-item subdocs; otherwise every
// outstanding item is returned. Mutates the booking but does not save it.
async function returnBookingItems(booking, company, onlyIds) {
  const now = new Date();
  const returned = [];
  for (const line of booking.items || []) {
    if (line.returnedAt) continue;
    if (onlyIds && !onlyIds.includes(String(line._id))) continue;
    const item = await InventoryItem.findOne({ _id: line.item, company });
    if (item) {
      const assignment = item.assignments.id(line.assignmentId);
      if (assignment && !assignment.returnedAt) {
        assignment.returnedAt = now;
        item.availableQuantity += assignment.quantity;
        await item.save();
      }
    }
    line.returnedAt = now;
    returned.push(line);
  }
  return returned;
}

// Takes stock out for every requested gear line. All-or-nothing: if any line
// can't be satisfied, lines already taken are put back and an error is thrown.
async function takeBookingItems(requested, { company, studentId, bookingId }) {
  const taken = [];
  try {
    for (const r of requested) {
      const qty = Math.floor(Number(r.quantity)) || 0;
      if (!r.itemId || qty < 1) throw new Error("Invalid equipment line");
      const item = await InventoryItem.findOneAndUpdate(
        { _id: r.itemId, company, availableQuantity: { $gte: qty } },
        {
          $inc: { availableQuantity: -qty },
          $push: {
            assignments: {
              ...(studentId
                ? { assignedTo: studentId, assignedToModel: "Student" }
                : {}),
              quantity: qty,
              notes: `Facility booking ${bookingId}`,
            },
          },
        },
        { new: true },
      );
      if (!item) {
        const existing = await InventoryItem.findOne({ _id: r.itemId, company });
        throw new Error(
          existing
            ? `Not enough stock for ${existing.name} (only ${existing.availableQuantity} available)`
            : "Equipment item not found",
        );
      }
      const assignment = item.assignments[item.assignments.length - 1];
      taken.push({ item: item._id, quantity: qty, assignmentId: assignment._id });
    }
  } catch (err) {
    for (const t of taken) {
      await InventoryItem.updateOne(
        { _id: t.item, company, "assignments._id": t.assignmentId },
        {
          $inc: { availableQuantity: t.quantity },
          $set: { "assignments.$.returnedAt": new Date() },
        },
      );
    }
    throw err;
  }
  return taken;
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
    .populate("items.item", "name photo")
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
  const { facilityId, studentId, date, startTime, endTime, notes, items } =
    req.body;
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

  // The booking is "for" a student — make sure that student is in this
  // academy (and, for a parent, is one of their own children).
  if (studentId) {
    const studentFilter = { _id: studentId, company: req.user.company };
    if (req.user.role === "parent") {
      studentFilter._id = { $in: req.user.children || [] };
      if (!(req.user.children || []).map(String).includes(String(studentId))) {
        res.status(403);
        throw new Error("You can only book for your own children");
      }
    }
    const studentDoc = await Student.findOne(studentFilter).select("_id");
    if (!studentDoc) {
      res.status(404);
      throw new Error("Student not found");
    }
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

  // Gear is staff-only; parents book the slot, the club hands out equipment.
  const requestedItems =
    req.user.role !== "parent" && Array.isArray(items) ? items : [];

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

  if (requestedItems.length > 0) {
    try {
      booking.items = await takeBookingItems(requestedItems, {
        company: req.user.company,
        studentId: studentId || undefined,
        bookingId: booking._id,
      });
      await booking.save();
    } catch (err) {
      await Booking.deleteOne({ _id: booking._id });
      res.status(400);
      throw err;
    }
  }

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
  const booking = await Booking.findOne(filter);
  if (!booking) {
    res.status(404);
    throw new Error("Booking not found");
  }
  booking.status = "cancelled";
  // A cancelled booking never uses the gear — put it back in stock.
  await returnBookingItems(booking, req.user.company);
  await booking.save();
  res.json({ success: true, data: booking });
});

// Records that gear taken with a booking has come back. Body: { itemIds? } —
// ids of the booking's item lines; omit to return everything outstanding.
const returnBookingItemsHandler = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!booking) {
    res.status(404);
    throw new Error("Booking not found");
  }
  const onlyIds = Array.isArray(req.body.itemIds)
    ? req.body.itemIds.map(String)
    : undefined;
  const returned = await returnBookingItems(booking, req.user.company, onlyIds);
  if (returned.length === 0) {
    res.status(400);
    throw new Error("No outstanding equipment to return");
  }
  // Everything back on a confirmed booking whose slot is over → completed.
  const allBack = booking.items.every((l) => l.returnedAt);
  if (allBack && booking.status === "confirmed") booking.status = "completed";
  await booking.save();
  await booking.populate("items.item", "name photo");
  res.json({ success: true, data: booking });
});

module.exports = {
  getBookings,
  createBooking,
  verifyBookingPayment,
  cancelBooking,
  returnBookingItems: returnBookingItemsHandler,
};
