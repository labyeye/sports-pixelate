const asyncHandler = require("express-async-handler");
const fs = require("fs");
const StudentSubscription = require("../models/StudentSubscription");
const SportsPlan = require("../models/SportsPlan");
const Student = require("../models/Student");
const razorpayService = require("../services/razorpayService");
const { validateMagicBytes } = require("../middleware/upload");
const { safePagination, safeSort } = require("../middleware/validate");

const SUBSCRIPTION_SORT_FIELDS = ["renewalDate", "startDate", "amount", "createdAt"];

// owner/staff: every subscription in the academy. parent: only their children's.
const getSubscriptions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { status, billingCycle } = req.query;

  const filter = { company: req.user.company };
  if (req.user.role === "parent") {
    filter.student = { $in: req.user.children || [] };
  }
  if (status) filter.status = status;
  if (billingCycle) filter.billingCycle = billingCycle;

  const sort = safeSort(req.query, SUBSCRIPTION_SORT_FIELDS, { createdAt: -1 });
  const total = await StudentSubscription.countDocuments(filter);
  const subscriptions = await StudentSubscription.find(filter)
    .populate("student", "firstName lastName studentId sport")
    .populate("plan", "name sport")
    .sort(sort)
    .skip(skip)
    .limit(limit);
  res.json({
    success: true,
    data: subscriptions,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

// Parent (or owner, e.g. enrolling a walk-in) starts a Razorpay order to
// subscribe a student to a plan.
const createOrder = asyncHandler(async (req, res) => {
  const { studentId, planId, billingCycle = "monthly" } = req.body;
  if (!["monthly", "yearly"].includes(billingCycle)) {
    res.status(400);
    throw new Error("Invalid billing cycle");
  }

  const student = await Student.findOne({
    _id: studentId,
    company: req.user.company,
  });
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }
  if (
    req.user.role === "parent" &&
    !(req.user.children || []).some((c) => c.toString() === studentId)
  ) {
    res.status(403);
    throw new Error("You can only subscribe your own child");
  }

  const plan = await SportsPlan.findOne({
    _id: planId,
    company: req.user.company,
    active: true,
  });
  if (!plan) {
    res.status(404);
    throw new Error("Plan not found");
  }

  const amount =
    billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

  const result = await razorpayService.createOrder({
    amount,
    receipt: `sub_${Date.now()}`,
    notes: {
      studentId: student._id.toString(),
      planId: plan._id.toString(),
      billingCycle,
      companyId: req.user.company.toString(),
    },
  });

  const startDate = new Date();
  const renewalDate = new Date();
  if (billingCycle === "yearly")
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  else renewalDate.setMonth(renewalDate.getMonth() + 1);

  await StudentSubscription.findOneAndUpdate(
    { student: student._id, plan: plan._id },
    {
      company: req.user.company,
      student: student._id,
      plan: plan._id,
      planName: plan.name,
      billingCycle,
      amount,
      startDate,
      renewalDate,
      status: "inactive",
      paymentStatus: "pending",
      razorpayOrderId: result.orderId,
      amountPaid: 0,
    },
    { upsert: true, new: true },
  );

  res.json({
    success: true,
    data: {
      orderId: result.orderId,
      keyId: result.keyId,
      amount,
      currency: "INR",
      planName: plan.name,
      studentName: `${student.firstName} ${student.lastName}`,
      billingCycle,
    },
  });
});

const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    res.status(400);
    throw new Error(
      "razorpayOrderId, razorpayPaymentId and razorpaySignature are required",
    );
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

  const subscription = await StudentSubscription.findOne({ razorpayOrderId });
  if (!subscription) {
    res.status(404);
    throw new Error("Order not found");
  }

  const startDate = new Date();
  const renewalDate = new Date();
  if (subscription.billingCycle === "yearly")
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  else renewalDate.setMonth(renewalDate.getMonth() + 1);

  const updated = await StudentSubscription.findByIdAndUpdate(
    subscription._id,
    {
      startDate,
      renewalDate,
      status: "active",
      paymentStatus: "completed",
      razorpayPaymentId,
      amountPaid: subscription.amount,
    },
    { new: true },
  ).populate("student", "firstName lastName");

  res.json({
    success: true,
    message: "Subscription activated successfully",
    data: updated,
  });
});

// Parent submits their UPI reference number after paying the owner's QR directly.
// No gateway call — the owner confirms manually via confirmQrPayment.
const createQrRenewalRequest = asyncHandler(async (req, res) => {
  const {
    studentId,
    planId,
    billingCycle = "monthly",
    referenceNumber,
  } = req.body;

  // Any validation failure past this point must also clean up the uploaded file.
  const fail = (status, message) => {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(status);
    throw new Error(message);
  };

  if (!req.file) {
    fail(400, "A screenshot of the payment is required");
  }
  try {
    await validateMagicBytes(req.file.path);
  } catch (err) {
    res.status(400);
    throw err;
  }

  if (!["monthly", "yearly"].includes(billingCycle)) {
    fail(400, "Invalid billing cycle");
  }
  if (!referenceNumber || !referenceNumber.trim()) {
    fail(400, "Payment reference number is required");
  }

  const student = await Student.findOne({
    _id: studentId,
    company: req.user.company,
  });
  if (!student) {
    fail(404, "Student not found");
  }
  if (
    req.user.role === "parent" &&
    !(req.user.children || []).some((c) => c.toString() === studentId)
  ) {
    fail(403, "You can only subscribe your own child");
  }

  const plan = await SportsPlan.findOne({
    _id: planId,
    company: req.user.company,
    active: true,
  });
  if (!plan) {
    fail(404, "Plan not found");
  }

  const amount =
    billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

  const startDate = new Date();
  const renewalDate = new Date();
  if (billingCycle === "yearly")
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  else renewalDate.setMonth(renewalDate.getMonth() + 1);

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const paymentScreenshot = `${baseUrl}/uploads/payment-screenshots/${req.file.filename}`;

  const subscription = await StudentSubscription.findOneAndUpdate(
    { student: student._id, plan: plan._id },
    {
      company: req.user.company,
      student: student._id,
      plan: plan._id,
      planName: plan.name,
      billingCycle,
      amount,
      startDate,
      renewalDate,
      status: "pending_renewal",
      paymentStatus: "pending",
      paymentMethod: "qr",
      qrReferenceNumber: referenceNumber.trim(),
      paymentScreenshot,
      qrSubmittedAt: new Date(),
      amountPaid: 0,
    },
    { upsert: true, new: true },
  );

  res.json({
    success: true,
    message: "Submitted — waiting for the club to confirm.",
    data: subscription,
  });
});

// Owner/staff confirms a QR-based renewal after checking their UPI app for the payment.
const confirmQrPayment = asyncHandler(async (req, res) => {
  if (req.user.role === "parent") {
    res.status(403);
    throw new Error("Only the club owner or staff can confirm a payment");
  }
  const subscription = await StudentSubscription.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!subscription) {
    res.status(404);
    throw new Error("Subscription not found");
  }
  if (
    subscription.paymentMethod !== "qr" ||
    subscription.paymentStatus !== "pending"
  ) {
    res.status(400);
    throw new Error("This subscription has no pending QR payment to confirm");
  }

  const startDate = new Date();
  const renewalDate = new Date();
  if (subscription.billingCycle === "yearly")
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  else renewalDate.setMonth(renewalDate.getMonth() + 1);

  const updated = await StudentSubscription.findByIdAndUpdate(
    subscription._id,
    {
      startDate,
      renewalDate,
      status: "active",
      paymentStatus: "completed",
      amountPaid: subscription.amount,
      confirmedBy: req.user._id,
    },
    { new: true },
  ).populate("student", "firstName lastName");

  res.json({ success: true, message: "Renewal confirmed", data: updated });
});

const cancelSubscription = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, company: req.user.company };
  if (req.user.role === "parent")
    filter.student = { $in: req.user.children || [] };

  const subscription = await StudentSubscription.findOneAndUpdate(
    filter,
    { status: "cancelled", autoRenew: false },
    { new: true },
  );
  if (!subscription) {
    res.status(404);
    throw new Error("Subscription not found");
  }
  res.json({ success: true, data: subscription });
});

module.exports = {
  getSubscriptions,
  createOrder,
  verifyPayment,
  createQrRenewalRequest,
  confirmQrPayment,
  cancelSubscription,
};
