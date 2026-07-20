const asyncHandler = require("express-async-handler");
const fs = require("fs");
const StudentSubscription = require("../models/StudentSubscription");
const SportsPlan = require("../models/SportsPlan");
const Student = require("../models/Student");
const User = require("../models/User");
const Company = require("../models/Company");
const Setting = require("../models/Setting");
const razorpayService = require("../services/razorpayService");
const { validateMagicBytes } = require("../middleware/upload");
const { safePagination, safeSort } = require("../middleware/validate");
const { generatePaymentReceiptPdf } = require("../services/pdfService");
const {
  sendPaymentVerified,
  sendPaymentVerifiedAdmin,
  sendPaymentRejected,
} = require("../services/whatsappService");

// Loads the company branding fields used to render the cheque-style PDF
// (same template/positions as the payroll payslip cheque).
async function getChequeCompanyInfo(companyId) {
  const setting = await Setting.findOne({ company: companyId })
    .select(
      "companyName companyAddress logoUrl chequeLogoX chequeLogoY chequeLogoW",
    )
    .lean();
  return {
    name: setting?.companyName || "",
    address: setting?.companyAddress || "",
    logo: setting?.logoUrl || "",
    chequeLogoX: setting?.chequeLogoX ?? 10,
    chequeLogoY: setting?.chequeLogoY ?? 20,
    chequeLogoW: setting?.chequeLogoW ?? 60,
  };
}

// Fire-and-forget: emails/PDFs the parent's opted-in guardian and every
// owner/staff user a receipt for a just-verified payment. Never throws —
// notification failures must not affect the payment-verification response.
async function notifyPaymentVerified(subscription, payment, companyId, verifiedByName) {
  try {
    const student = await Student.findById(subscription.student).select(
      "firstName lastName studentId guardians",
    );
    if (!student) return;

    const company = await getChequeCompanyInfo(companyId);
    const pdfBuffer = await generatePaymentReceiptPdf({
      subscription: { ...subscription.toObject(), student },
      payment,
      company,
    });
    const studentName = `${student.firstName} ${student.lastName}`.trim();
    const balanceDue = Math.max(subscription.amount - subscription.amountPaid, 0);

    const guardian = (student.guardians || []).find(
      (g) => g.receivesWhatsapp && g.phone,
    );
    if (guardian) {
      await sendPaymentVerified(
        guardian.phone,
        {
          guardianName: guardian.name,
          studentName,
          planName: subscription.planName,
          amount: payment.amount,
          paymentMode: payment.method,
          paidOn: payment.verifiedAt,
          balanceDue,
        },
        companyId,
        pdfBuffer,
      );
    }

    const companyDoc = await Company.findById(companyId).select("phone");
    const admins = await User.find({
      company: companyId,
      role: { $in: ["super_admin", "hr_manager"] },
    }).select("phone role");
    for (const admin of admins) {
      const phone =
        admin.phone || (admin.role === "super_admin" ? companyDoc?.phone : null);
      if (phone) {
        await sendPaymentVerifiedAdmin(
          phone,
          {
            studentName,
            studentId: student.studentId,
            planName: subscription.planName,
            amount: payment.amount,
            paymentMode: payment.method,
            verifiedByName,
            balanceDue,
          },
          companyId,
          pdfBuffer,
        );
      }
    }
  } catch (err) {
    console.error("[Subscription] WA payment-verified notify failed:", err.message);
  }
}

async function notifyPaymentRejected(subscription, payment, companyId) {
  try {
    const student = await Student.findById(subscription.student).select(
      "firstName lastName guardians",
    );
    if (!student) return;
    const guardian = (student.guardians || []).find(
      (g) => g.receivesWhatsapp && g.phone,
    );
    if (!guardian) return;
    await sendPaymentRejected(
      guardian.phone,
      {
        guardianName: guardian.name,
        amount: payment.amount,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        planName: subscription.planName,
        reason: payment.rejectionReason,
      },
      companyId,
    );
  } catch (err) {
    console.error("[Subscription] WA payment-rejected notify failed:", err.message);
  }
}

// Recomputes amountPaid/paymentStatus from payments[] and, the first time the
// subscription crosses fully-paid, activates it and extends the renewal date.
// Returns the updated document.
async function recalcSubscriptionTotals(subscription) {
  const verifiedTotal = subscription.payments
    .filter((p) => p.status === "verified")
    .reduce((sum, p) => sum + p.amount, 0);

  const wasCompleted = subscription.paymentStatus === "completed";
  subscription.amountPaid = verifiedTotal;

  if (verifiedTotal >= subscription.amount) {
    subscription.paymentStatus = "completed";
    if (!wasCompleted) {
      const startDate = new Date();
      const renewalDate = new Date();
      if (subscription.billingCycle === "yearly")
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      else renewalDate.setMonth(renewalDate.getMonth() + 1);
      subscription.startDate = startDate;
      subscription.renewalDate = renewalDate;
      subscription.status = "active";
    }
  } else if (verifiedTotal > 0) {
    subscription.paymentStatus = "partial";
  }

  await subscription.save();
  return subscription;
}

// Pushes a new pending payment attempt onto a subscription's history.
// Shared by the first-payment (qr-renewal) and top-up (:id/payments) routes.
async function submitPayment(
  subscription,
  { amount, utrNumber, transactionNumber, screenshot, method = "qr" },
) {
  subscription.payments.push({
    amount,
    method,
    utrNumber,
    transactionNumber,
    screenshot,
    status: "pending",
    submittedAt: new Date(),
  });
  subscription.paymentMethod = method;
  await subscription.save();
  return subscription;
}

const SUBSCRIPTION_SORT_FIELDS = [
  "renewalDate",
  "startDate",
  "amount",
  "createdAt",
];

// owner/staff: every subscription in the academy. parent: only their children's.
const getSubscriptions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { status, billingCycle, studentId } = req.query;

  const filter = { company: req.user.company };
  if (req.user.role === "parent") {
    filter.student = { $in: req.user.children || [] };
  }
  if (status) filter.status = status;
  if (billingCycle) filter.billingCycle = billingCycle;
  if (studentId) {
    if (
      req.user.role === "parent" &&
      !(req.user.children || []).some((c) => c.toString() === studentId)
    ) {
      filter.student = null; // not one of this parent's children — no results
    } else {
      filter.student = studentId;
    }
  }

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

  subscription.razorpayPaymentId = razorpayPaymentId;
  subscription.payments.push({
    amount: subscription.amount,
    method: "razorpay",
    razorpayOrderId,
    razorpayPaymentId,
    status: "verified",
    submittedAt: new Date(),
    verifiedAt: new Date(),
  });
  const updated = await recalcSubscriptionTotals(subscription);
  await updated.populate("student", "firstName lastName");

  const payment = updated.payments[updated.payments.length - 1];
  notifyPaymentVerified(updated, payment, req.user.company, "Razorpay (auto)");

  res.json({
    success: true,
    message: "Subscription activated successfully",
    data: updated,
  });
});

// Shared by the parent's first QR payment and any later top-up of the
// remaining balance — validates the mandatory UTR/transaction/screenshot,
// resolves the student+plan, and appends a pending entry to payments[].
async function handlePaymentSubmission(req, res, { subscription }) {
  const { referenceNumber, transactionNumber, amount } = req.body;

  const fail = (status, message) => {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(status);
    throw new Error(message);
  };

  if (!req.file) fail(400, "A screenshot of the payment is required");
  try {
    await validateMagicBytes(req.file.path);
  } catch (err) {
    res.status(400);
    throw err;
  }
  if (!referenceNumber || !referenceNumber.trim()) {
    fail(400, "UTR number is required");
  }
  if (!transactionNumber || !transactionNumber.trim()) {
    fail(400, "Transaction number is required");
  }

  const remaining = subscription.amount - subscription.amountPaid;
  let payAmount = amount !== undefined ? Number(amount) : remaining;
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    fail(400, "Enter a valid amount to pay");
  }
  if (payAmount > remaining + 0.01) {
    fail(400, `Amount cannot exceed the remaining balance of ₹${remaining}`);
  }
  if (subscription.payments.some((p) => p.status === "pending")) {
    fail(
      400,
      "A payment is already awaiting verification for this subscription",
    );
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const screenshot = `${baseUrl}/uploads/payment-screenshots/${req.file.filename}`;

  await submitPayment(subscription, {
    amount: payAmount,
    utrNumber: referenceNumber.trim(),
    transactionNumber: transactionNumber.trim(),
    screenshot,
    method: "qr",
  });

  res.json({
    success: true,
    message: "Submitted — waiting for the club to verify.",
    data: subscription,
  });
}

// Parent submits their first UPI payment (full or partial) for a plan they
// haven't subscribed to yet — creates the subscription record. No gateway
// call — the owner confirms manually via verifyQrPayment.
const createQrRenewalRequest = asyncHandler(async (req, res) => {
  const { studentId, planId, billingCycle = "monthly" } = req.body;

  const fail = (status, message) => {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(status);
    throw new Error(message);
  };

  if (!["monthly", "yearly"].includes(billingCycle)) {
    fail(400, "Invalid billing cycle");
  }

  const student = await Student.findOne({
    _id: studentId,
    company: req.user.company,
  });
  if (!student) fail(404, "Student not found");
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
  if (!plan) fail(404, "Plan not found");

  const amount =
    billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

  let subscription = await StudentSubscription.findOne({
    student: student._id,
    plan: plan._id,
  });
  if (!subscription) {
    subscription = new StudentSubscription({
      company: req.user.company,
      student: student._id,
      plan: plan._id,
      planName: plan.name,
      billingCycle,
      amount,
      startDate: new Date(),
      renewalDate: new Date(),
      status: "pending_renewal",
      paymentStatus: "pending",
      paymentMethod: "qr",
      amountPaid: 0,
      payments: [],
    });
  } else if (
    subscription.status === "cancelled" ||
    subscription.status === "inactive"
  ) {
    // Re-subscribing after cancellation/expiry starts a fresh payment cycle.
    subscription.billingCycle = billingCycle;
    subscription.amount = amount;
    subscription.status = "pending_renewal";
    subscription.paymentStatus = "pending";
    subscription.amountPaid = 0;
    subscription.payments = [];
  }

  await handlePaymentSubmission(req, res, { subscription });
});

// Owner/staff assigns a plan to a student directly from the student form —
// no payment attached yet. Creates a pending subscription so the parent sees
// it as "to be paid" on their subscriptions page and can pay via QR/Razorpay.
const assignSubscription = asyncHandler(async (req, res) => {
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

  let subscription = await StudentSubscription.findOne({
    student: student._id,
    plan: plan._id,
  });
  if (!subscription) {
    subscription = new StudentSubscription({
      company: req.user.company,
      student: student._id,
      plan: plan._id,
      planName: plan.name,
      billingCycle,
      amount,
      startDate: new Date(),
      renewalDate: new Date(),
      status: "pending_renewal",
      paymentStatus: "pending",
      amountPaid: 0,
      payments: [],
    });
  } else if (
    subscription.status === "cancelled" ||
    subscription.status === "inactive"
  ) {
    subscription.billingCycle = billingCycle;
    subscription.amount = amount;
    subscription.status = "pending_renewal";
    subscription.paymentStatus = "pending";
    subscription.amountPaid = 0;
    subscription.payments = [];
  } else {
    // Already active/pending on this plan — just sync the billing cycle.
    subscription.billingCycle = billingCycle;
    subscription.amount = amount;
  }

  await subscription.save();
  await subscription.populate("plan", "name sport");
  res.status(201).json({ success: true, data: subscription });
});

// Parent tops up the remaining balance on an existing subscription with
// another UTR/transaction/screenshot submission.
const submitInstallmentPayment = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, company: req.user.company };
  if (req.user.role === "parent")
    filter.student = { $in: req.user.children || [] };

  const subscription = await StudentSubscription.findOne(filter);
  if (!subscription) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(404);
    throw new Error("Subscription not found");
  }
  if (subscription.amountPaid >= subscription.amount) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(400);
    throw new Error("This subscription is already fully paid");
  }

  await handlePaymentSubmission(req, res, { subscription });
});

// Owner/staff verifies a single payment entry after checking their UPI app.
const verifyQrPayment = asyncHandler(async (req, res) => {
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
  const payment = subscription.payments.id(req.params.paymentId);
  if (!payment || payment.status !== "pending") {
    res.status(400);
    throw new Error("This payment is not awaiting verification");
  }

  payment.status = "verified";
  payment.verifiedBy = req.user._id;
  payment.verifiedAt = new Date();
  const updated = await recalcSubscriptionTotals(subscription);
  await updated.populate("student", "firstName lastName");

  notifyPaymentVerified(updated, payment, req.user.company, req.user.name);

  res.json({ success: true, message: "Payment verified", data: updated });
});

// Owner/staff marks a single payment entry as not verified — the parent must
// submit a new UTR/transaction number and screenshot to retry that amount.
const rejectQrPayment = asyncHandler(async (req, res) => {
  if (req.user.role === "parent") {
    res.status(403);
    throw new Error("Only the club owner or staff can review a payment");
  }
  const subscription = await StudentSubscription.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!subscription) {
    res.status(404);
    throw new Error("Subscription not found");
  }
  const payment = subscription.payments.id(req.params.paymentId);
  if (!payment || payment.status !== "pending") {
    res.status(400);
    throw new Error("This payment is not awaiting verification");
  }

  const { reason } = req.body;
  payment.status = "rejected";
  payment.rejectedBy = req.user._id;
  payment.rejectionReason = reason || "";
  await subscription.save();

  await subscription.populate("student", "firstName lastName");

  notifyPaymentRejected(subscription, payment, req.user.company);

  res.json({
    success: true,
    message: "Payment marked as not verified",
    data: subscription,
  });
});

// Streams a PDF receipt for a single verified payment entry.
const getPaymentReceipt = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, company: req.user.company };
  if (req.user.role === "parent")
    filter.student = { $in: req.user.children || [] };

  const subscription = await StudentSubscription.findOne(filter).populate(
    "student",
    "firstName lastName studentId",
  );
  if (!subscription) {
    res.status(404);
    throw new Error("Subscription not found");
  }
  const payment = subscription.payments.id(req.params.paymentId);
  if (!payment || payment.status !== "verified") {
    res.status(404);
    throw new Error("No verified payment found with that id");
  }

  const company = await getChequeCompanyInfo(req.user.company);
  const pdfBytes = await generatePaymentReceiptPdf({
    subscription,
    payment,
    company,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=receipt_${payment._id}.pdf`,
  );
  res.send(Buffer.from(pdfBytes));
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

// Bulk create subscription records from a parsed spreadsheet (Excel import),
// for backfilling historical/pre-existing subscriptions directly — bypasses
// the Razorpay/QR payment flow entirely, same as an admin manually recording
// a past subscription.
const bulkImportSubscriptions = asyncHandler(async (req, res) => {
  const { subscriptions: rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400);
    throw new Error("subscriptions array is required");
  }
  if (rows.length > 200) {
    res.status(400);
    throw new Error("Maximum 200 subscriptions per import");
  }

  const [allStudents, allPlans] = await Promise.all([
    Student.find({ company: req.user.company }).select(
      "studentId firstName lastName",
    ),
    SportsPlan.find({ company: req.user.company }).select("name"),
  ]);

  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const studentMatch = allStudents.find(
        (s) =>
          s.studentId?.toLowerCase() ===
          String(row.studentId || "").toLowerCase(),
      );
      const planMatch = allPlans.find(
        (p) =>
          p.name.toLowerCase() === String(row.planName || "").toLowerCase(),
      );
      const billingCycle = ["monthly", "yearly"].includes(row.billingCycle)
        ? row.billingCycle
        : undefined;

      if (!studentMatch || !planMatch || !billingCycle) {
        results.push({
          row: i + 1,
          status: "error",
          message: !studentMatch
            ? `No student found with studentId "${row.studentId}"`
            : !planMatch
              ? `No plan found named "${row.planName}"`
              : "billingCycle must be 'monthly' or 'yearly'",
        });
        continue;
      }

      const startDate = row.startDate ? new Date(row.startDate) : new Date();
      let renewalDate = row.renewalDate ? new Date(row.renewalDate) : undefined;
      if (!renewalDate) {
        renewalDate = new Date(startDate);
        if (billingCycle === "yearly")
          renewalDate.setFullYear(renewalDate.getFullYear() + 1);
        else renewalDate.setMonth(renewalDate.getMonth() + 1);
      }

      const subscription = await StudentSubscription.create({
        company: req.user.company,
        student: studentMatch._id,
        plan: planMatch._id,
        planName: planMatch.name,
        billingCycle,
        amount: Number(row.amount) || 0,
        startDate,
        renewalDate,
        status: ["active", "inactive", "cancelled", "pending_renewal"].includes(
          row.status,
        )
          ? row.status
          : "active",
        paymentStatus: "completed",
        amountPaid: Number(row.amount) || 0,
        paymentMethod: row.paymentMethod === "qr" ? "qr" : "razorpay",
      });

      results.push({
        row: i + 1,
        status: "success",
        student: `${studentMatch.firstName} ${studentMatch.lastName}`,
      });
    } catch (err) {
      results.push({ row: i + 1, status: "error", message: err.message });
    }
  }

  const imported = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;

  res.json({ success: true, imported, failed, results });
});

module.exports = {
  getSubscriptions,
  createOrder,
  verifyPayment,
  createQrRenewalRequest,
  assignSubscription,
  submitInstallmentPayment,
  verifyQrPayment,
  rejectQrPayment,
  getPaymentReceipt,
  cancelSubscription,
  bulkImportSubscriptions,
};
