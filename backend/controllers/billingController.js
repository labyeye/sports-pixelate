const asyncHandler = require("express-async-handler");
const { Saga, refundAfterFailure } = require("../utils/paymentSaga");
const crypto = require("crypto");
const Company = require("../models/Company");
const Employee = require("../models/Employee");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const Counter = require("../models/Counter");
const User = require("../models/User");
const OfferCode = require("../models/OfferCode");
const PendingOrder = require("../models/PendingOrder");
const razorpayService = require("../services/razorpayService");
const { sendPaymentConfirmations } = require("../services/notificationService");
const {
  RATE_INAPP,
  RATE_WHATSAPP,
  calculatePricing,
} = require("../utils/pricing");
const { lookupAndValidateOffer } = require("../utils/offerCode");

// Company-level SaaS billing (what an academy pays NestAcademy). Priced per user
// (students + employees) per month, + 18% GST — see utils/pricing.js.
//
// New signup: createOrder stores a PendingOrder; the Company, Subscription and
// Invoice are created only after the gateway payment is verified.
// Existing company: createOrder updates its Subscription, which is activated on verify.
const PLAN_NAME = "NestAcademy";

/** GET /billing/plans — public; the single plan and its per-user monthly rates. */
const getPlans = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: [
      {
        name: PLAN_NAME,
        rateInAppMonthly: RATE_INAPP,
        rateWhatsappMonthly: RATE_WHATSAPP,
      },
    ],
  });
});

/** GET /billing/subscription — the logged-in owner's company subscription. */
const getSubscription = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company)
    return res
      .status(404)
      .json({ success: false, message: "SportsClub not found" });
  const subscription = await Subscription.findOne({
    company: company._id,
  }).populate("company", "name email");
  if (!subscription)
    return res
      .status(404)
      .json({ success: false, message: "No active subscription found" });
  const currentEmployeeCount = await Employee.countDocuments({
    company: company._id,
    status: "active",
  });
  res.json({
    success: true,
    data: { ...subscription.toObject(), currentEmployeeCount },
  });
});

/** GET /billing/invoices — the company's 20 most recent invoices, newest first. */
const getInvoices = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company)
    return res
      .status(404)
      .json({ success: false, message: "SportsClub not found" });
  const invoices = await Invoice.find({ company: company._id })
    .populate(
      "company",
      "name email phone address city state pincode gstNumber panNumber",
    )
    .sort({ createdAt: -1 })
    .limit(20);
  res.json({ success: true, data: invoices });
});

// Shared checks used by both the validate-only endpoint and createOrder.
// Throws with res.status already set — call inside asyncHandler.
async function _lookupAndCheckOffer(code, res) {
  try {
    return await lookupAndValidateOffer(code);
  } catch (err) {
    res.status(err.status || 500);
    throw err;
  }
}

function _offerMessage(offer) {
  if (offer.discountType === "bonus_months") {
    return `Offer code applied! You will get ${offer.bonusMonths} bonus month(s) added to your subscription.`;
  }
  if (offer.discountType === "flat_rate") {
    return `Offer code applied! Your rate is now ₹${offer.flatRate}/user/month.`;
  }
  return `Offer code applied! ${offer.percentOff}% off your order.`;
}

/**
 * POST /billing/validate-offer — checks an offer code and returns a price
 * preview for the given headcount. Creates nothing and does not consume a use.
 */
const validateOfferCode = asyncHandler(async (req, res) => {
  const { code, studentCount, employeeCount, wantsWhatsapp } = req.body;
  if (!code) {
    res.status(400);
    throw new Error("Offer code is required");
  }

  const offer = await _lookupAndCheckOffer(code, res);

  const count = Number(studentCount) || 0;
  const empCount = Number(employeeCount) || 0;
  const preview =
    count > 0 || empCount > 0
      ? calculatePricing(count, empCount, !!wantsWhatsapp, offer)
      : null;

  res.json({
    success: true,
    message: _offerMessage(offer),
    data: {
      code: offer.code,
      discountType: offer.discountType,
      bonusMonths: offer.bonusMonths,
      flatRate: offer.flatRate,
      percentOff: offer.percentOff,
      description: offer.description,
      remainingUses: offer.maxUses - offer.usedCount,
      preview,
    },
  });
});

/**
 * POST /billing/create-order — prices the order server-side (never trusts a
 * client total) and opens a payment order on Razorpay.
 * Body: studentCount, employeeCount, wantsWhatsapp, billingCycle, gateway, offerCode,
 * and `company` details for a first-time signup.
 */
const createOrder = asyncHandler(async (req, res) => {
  const {
    studentCount,
    employeeCount = 0,
    wantsWhatsapp = false,
    billingCycle = "monthly",
    gateway = "razorpay",
    offerCode,
    company: companyDetails,
  } = req.body;

  const count = Number(studentCount);
  if (!count || count < 1 || !Number.isInteger(count)) {
    res.status(400);
    throw new Error("Please provide a valid number of students");
  }
  const empCount = Number(employeeCount) || 0;
  if (empCount < 0 || !Number.isInteger(empCount)) {
    res.status(400);
    throw new Error("Please provide a valid number of employees");
  }
  if (!["monthly", "yearly"].includes(billingCycle)) {
    res.status(400);
    throw new Error("Invalid billing cycle");
  }
  if (gateway !== "razorpay") {
    res.status(400);
    throw new Error("Invalid gateway. Only razorpay is supported");
  }

  const planName = PLAN_NAME;

  const existingCompany = await Company.findOne({ createdBy: req.user._id });

  // Validate offer code if provided
  let validatedOffer = null;
  if (offerCode) {
    validatedOffer = await _lookupAndCheckOffer(offerCode, res);
  }

  const pricing = calculatePricing(
    count,
    empCount,
    !!wantsWhatsapp,
    validatedOffer,
  );

  const amountRupees =
    billingCycle === "yearly" ? pricing.yearlyPrice : pricing.monthlyPrice;
  const subtotal =
    billingCycle === "yearly"
      ? pricing.yearlySubtotal
      : pricing.monthlySubtotal;
  const gstAmount =
    billingCycle === "yearly"
      ? pricing.yearlyGstAmount
      : pricing.monthlyGstAmount;

  // New signup: no Company exists yet. Company/Subscription are only created
  // once payment is verified — don't touch either collection here.
  let newCompanyDetails = null;
  if (!existingCompany) {
    const {
      name,
      email,
      phone,
      website,
      gstNumber,
      panNumber,
      address,
      city,
      state,
      pincode,
    } = companyDetails || {};
    if (!name || !phone) {
      res.status(400);
      throw new Error("SportsClub name and phone are required");
    }
    const emailToUse = email || req.user.email;
    if (await Company.findOne({ email: emailToUse })) {
      res.status(400);
      throw new Error("SportsClub email already exists");
    }
    newCompanyDetails = {
      name,
      email: emailToUse,
      phone,
      website,
      gstNumber,
      panNumber,
      address,
      city,
      state,
      pincode,
    };
  }

  let orderData;

  if (gateway === "razorpay") {
    const result = await razorpayService.createOrder({
      amount: amountRupees,
      receipt: `rcpt_${Date.now()}`,
      notes: {
        studentCount: count,
        employeeCount: empCount,
        billingCycle,
        userId: req.user._id.toString(),
        companyId: existingCompany ? existingCompany._id.toString() : "",
      },
    });

    if (existingCompany) {
      await Subscription.findOneAndUpdate(
        { company: existingCompany._id },
        {
          company: existingCompany._id,
          plan: planName,
          studentCount: count,
          employeeCount: empCount,
          wantsWhatsapp: !!wantsWhatsapp,
          ratePerUnit: pricing.ratePerUnit,
          monthlyPrice: pricing.monthlyPrice,
          yearlyPrice: pricing.yearlyPrice,
          gstRate: pricing.gstRate,
          subtotal,
          gstAmount,
          maxStudents: count,
          maxEmployees: empCount,
          billingCycle,
          startDate: new Date(),
          renewalDate: new Date(),
          status: "inactive",
          paymentStatus: "pending",
          paymentMethod: "razorpay",
          amountPaid: 0,
          razorpayOrderId: result.orderId,
          offerCode: validatedOffer ? validatedOffer.code : null,
          offerBonusMonths: validatedOffer ? validatedOffer.bonusMonths : 0,
        },
        { upsert: true, new: true },
      );
    } else {
      await PendingOrder.create({
        orderId: result.orderId,
        gateway: "razorpay",
        user: req.user._id,
        companyName: newCompanyDetails.name,
        companyEmail: newCompanyDetails.email,
        companyPhone: newCompanyDetails.phone,
        website: newCompanyDetails.website,
        gstNumber: newCompanyDetails.gstNumber,
        panNumber: newCompanyDetails.panNumber,
        address: newCompanyDetails.address,
        city: newCompanyDetails.city,
        state: newCompanyDetails.state,
        pincode: newCompanyDetails.pincode,
        studentCount: count,
        employeeCount: empCount,
        wantsWhatsapp: !!wantsWhatsapp,
        billingCycle,
        ratePerUnit: pricing.ratePerUnit,
        monthlyPrice: pricing.monthlyPrice,
        yearlyPrice: pricing.yearlyPrice,
        gstRate: pricing.gstRate,
        subtotal,
        gstAmount,
        offerCode: validatedOffer ? validatedOffer.code : null,
        offerBonusMonths: validatedOffer ? validatedOffer.bonusMonths : 0,
      });
    }

    orderData = {
      gateway: "razorpay",
      orderId: result.orderId,
      keyId: result.keyId,
      amount: amountRupees,
      subtotal,
      gstRate: pricing.gstRate,
      gstAmount,
      currency: "INR",
      studentCount: count,
      employeeCount: empCount,
      wantsWhatsapp: !!wantsWhatsapp,
      ratePerUnit: pricing.ratePerUnit,
      plan: planName,
      billingCycle,
      companyName: existingCompany
        ? existingCompany.name
        : newCompanyDetails.name,
      userName: req.user.name,
      userEmail: req.user.email,
      userPhone:
        req.user.phone ||
        (existingCompany ? existingCompany.phone : newCompanyDetails.phone) ||
        "",
      offerApplied: !!validatedOffer,
      bonusMonths: validatedOffer ? validatedOffer.bonusMonths : 0,
    };
  }

  res.json({ success: true, data: orderData });
});

/**
 * POST /billing/verify-razorpay — verifies the Razorpay signature, then
 * activates the subscription (creating the company on first purchase).
 */
const verifyRazorpayPayment = asyncHandler(async (req, res) => {
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

  const pendingOrder = await PendingOrder.findOne({ orderId: razorpayOrderId });
  if (pendingOrder) {
    await _createCompanyAndActivate({
      pendingOrder,
      req,
      update: {
        razorpayPaymentId,
        paymentMethod: "razorpay",
        paymentStatus: "completed",
      },
      invoiceExtra: { razorpayOrderId, razorpayPaymentId },
      res,
    });
    return;
  }

  await _activateSubscription({
    req,
    lookup: { razorpayOrderId },
    update: {
      razorpayPaymentId,
      paymentMethod: "razorpay",
      paymentStatus: "completed",
    },
    invoiceExtra: { razorpayOrderId, razorpayPaymentId },
    res,
  });
});

// First purchase: turns a verified PendingOrder into a Company + Subscription
// + Invoice. Guards against a foreign order, a second company for the same
// user, or a duplicate company email; consumes the offer code if one was used.
async function _createCompanyAndActivateSteps({
  pendingOrder,
  req,
  update,
  invoiceExtra,
  res, saga }) {
  if (pendingOrder.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("This order does not belong to the current user.");
  }

  const existingCompany = await Company.findOne({ createdBy: req.user._id });
  if (existingCompany) {
    await PendingOrder.deleteOne({ _id: pendingOrder._id });
    res.status(400);
    throw new Error("User already has a SportsClub");
  }
  if (await Company.findOne({ email: pendingOrder.companyEmail })) {
    await PendingOrder.deleteOne({ _id: pendingOrder._id });
    res.status(400);
    throw new Error("SportsClub email already exists");
  }

  const company = await saga.create(Company, {
    name: pendingOrder.companyName,
    email: pendingOrder.companyEmail,
    phone: pendingOrder.companyPhone,
    password: crypto.randomBytes(16).toString("hex"),
    website: pendingOrder.website,
    gstNumber: pendingOrder.gstNumber,
    panNumber: pendingOrder.panNumber,
    address: pendingOrder.address,
    city: pendingOrder.city,
    state: pendingOrder.state,
    pincode: pendingOrder.pincode,
    status: "active",
    createdBy: req.user._id,
  });

  const amountPaid =
    pendingOrder.billingCycle === "yearly"
      ? pendingOrder.yearlyPrice
      : pendingOrder.monthlyPrice;
  saga.amount = amountPaid;

  const startDate = new Date();
  const renewalDate = new Date();
  if (pendingOrder.billingCycle === "yearly") {
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  } else {
    renewalDate.setMonth(renewalDate.getMonth() + 1);
  }
  const bonusMonths = pendingOrder.offerBonusMonths || 0;
  if (bonusMonths > 0) {
    renewalDate.setMonth(renewalDate.getMonth() + bonusMonths);
  }

  const planName = PLAN_NAME;

  const subscription = await saga.create(Subscription, {
    company: company._id,
    plan: planName,
    studentCount: pendingOrder.studentCount,
    employeeCount: pendingOrder.employeeCount,
    wantsWhatsapp: pendingOrder.wantsWhatsapp,
    ratePerUnit: pendingOrder.ratePerUnit,
    monthlyPrice: pendingOrder.monthlyPrice,
    yearlyPrice: pendingOrder.yearlyPrice,
    gstRate: pendingOrder.gstRate,
    subtotal: pendingOrder.subtotal,
    gstAmount: pendingOrder.gstAmount,
    maxStudents: pendingOrder.studentCount,
    maxEmployees: pendingOrder.employeeCount,
    billingCycle: pendingOrder.billingCycle,
    startDate,
    renewalDate,
    status: "active",
    amountPaid,
    offerCode: pendingOrder.offerCode,
    offerBonusMonths: pendingOrder.offerBonusMonths,
    ...update,
  });

  await saga.patch(Company, company._id, { subscription: subscription._id });

  req.user.company = company._id;
  if (!req.user.phone && company.phone) {
    req.user.phone = company.phone;
  }
  await saga.patch(User, req.user._id, { company: company._id, ...(req.user.phone ? { phone: req.user.phone } : {}) });

  let offerCodeDoc = null;
  if (pendingOrder.offerCode) {
    offerCodeDoc = await saga.inc(OfferCode, { code: pendingOrder.offerCode }, "usedCount", 1);
  }

  const invoiceSeq = await Counter.next("sportsInvoice", () =>
    Invoice.countDocuments(),
  );
  const invoiceNumber = `INV-SPORTS-${String(invoiceSeq).padStart(4, "0")}`;
  await saga.create(Invoice, {
    company: company._id,
    subscription: subscription._id,
    invoiceNumber,
    plan: planName,
    billingCycle: pendingOrder.billingCycle,
    amount: amountPaid,
    gstRate: pendingOrder.gstRate,
    subtotal: pendingOrder.subtotal,
    gstAmount: pendingOrder.gstAmount,
    status: "paid",
    paidAt: new Date(),
    ...invoiceExtra,
  });

  if (offerCodeDoc) {
    await OfferCode.findByIdAndUpdate(offerCodeDoc._id, {
      $push: {
        usages: {
          company: company._id,
          companyName: company.name,
          userEmail: company.email,
          invoiceNumber,
          usedAt: new Date(),
        },
      },
    });
  }

  await PendingOrder.deleteOne({ _id: pendingOrder._id }).catch(() => {});

  const dashboardUrl = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/`
    : "https://sports.pixelatenest.com/";

  sendPaymentConfirmations({
    toEmail: req.user.email || company.email,
    toName: req.user.name || company.name,
    toPhone: req.user.phone || company.phone || "",
    companyName: company.name,
    planName: planName,
    amount: amountPaid,
    billingCycle: pendingOrder.billingCycle,
    renewalDate,
    dashboardUrl,
    invoiceNumber,
  }).catch((err) => console.error("[Notifications]", err.message));

  res.status(201).json({
    success: true,
    message: "SportsClub created and subscription activated successfully",
    data: {
      company: {
        _id: company._id,
        name: company.name,
        email: company.email,
        status: company.status,
      },
      plan: planName,
      billingCycle: pendingOrder.billingCycle,
      amount: amountPaid,
      renewalDate,
      invoiceNumber,
      offerApplied: bonusMonths > 0,
      bonusMonths: bonusMonths > 0 ? bonusMonths : undefined,
      offerMessage:
        bonusMonths > 0
          ? `Congratulations! ${bonusMonths} bonus month(s) added to your subscription.`
          : undefined,
    },
  });
}

// Renewal / upgrade: activates the existing Subscription located by `lookup`,
// applies `update`, extends the period (plus any bonus months) and issues the Invoice.
async function _activateSubscriptionSteps({
  lookup,
  update,
  invoiceExtra,
  res,
  req, saga }) {
  const subscription = await Subscription.findOne(lookup);
  if (!subscription) {
    res.status(404);
    throw new Error("Order not found. Please contact support.");
  }
  if (req?.user && String(subscription.company) !== String(req.user.company)) {
    res.status(403);
    throw new Error("This order does not belong to your academy.");
  }
  // A Razorpay signature stays valid forever; without this, replaying an old (orderId, paymentId, signature)
  // would re-activate an expired plan for free and stack invoices and offer-code usage.
  if (subscription.paymentStatus === "completed") {
    return res.json({
      success: true,
      message: "This payment was already processed.",
      data: {
        plan: subscription.plan,
        billingCycle: subscription.billingCycle,
        renewalDate: subscription.renewalDate,
      },
    });
  }

  const company = await Company.findById(subscription.company);
  if (!company) {
    res.status(404);
    throw new Error("Company not found");
  }

  const planName = subscription.plan;
  const amountPaid =
    subscription.billingCycle === "yearly"
      ? subscription.yearlyPrice
      : subscription.monthlyPrice;
  saga.amount = amountPaid;

  const startDate = new Date();
  const renewalDate = new Date();
  if (subscription.billingCycle === "yearly") {
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  } else {
    renewalDate.setMonth(renewalDate.getMonth() + 1);
  }

  // Apply bonus months from offer code if present
  const bonusMonths = subscription.offerBonusMonths || 0;
  if (bonusMonths > 0) {
    renewalDate.setMonth(renewalDate.getMonth() + bonusMonths);
  }

  await saga.patch(Subscription, subscription._id, { startDate, renewalDate, status: "active", amountPaid, ...update });
  const updatedSub = await Subscription.findById(subscription._id);

  // Record offer code usage (invoiceNumber assigned just below)
  let offerCodeDoc = null;
  if (subscription.offerCode) {
    offerCodeDoc = await saga.inc(OfferCode, { code: subscription.offerCode }, "usedCount", 1);
  }

  await saga.patch(Company, company._id, {
    status: "active",
    subscription: updatedSub._id,
  });

  const invoiceSeq = await Counter.next("sportsInvoice", () =>
    Invoice.countDocuments(),
  );
  const invoiceNumber = `INV-SPORTS-${String(invoiceSeq).padStart(4, "0")}`;
  await saga.create(Invoice, {
    company: company._id,
    subscription: updatedSub._id,
    invoiceNumber,
    plan: planName,
    billingCycle: subscription.billingCycle,
    amount: amountPaid,
    gstRate: subscription.gstRate,
    subtotal: subscription.subtotal,
    gstAmount: subscription.gstAmount,
    status: "paid",
    paidAt: new Date(),
    ...invoiceExtra,
  });

  // Add invoice number to offer usage log
  if (offerCodeDoc) {
    await OfferCode.findByIdAndUpdate(offerCodeDoc._id, {
      $push: {
        usages: {
          company: company._id,
          companyName: company.name,
          userEmail: company.email,
          invoiceNumber,
          usedAt: new Date(),
        },
      },
    });
  }

  const user = await User.findById(company.createdBy);
  const dashboardUrl = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/`
    : "https://sports.pixelatenest.com/";

  sendPaymentConfirmations({
    toEmail: user?.email || company.email,
    toName: user?.name || company.name,
    toPhone: user?.phone || company.phone || "",
    companyName: company.name,
    planName: planName,
    amount: amountPaid,
    billingCycle: subscription.billingCycle,
    renewalDate,
    dashboardUrl,
    invoiceNumber,
  }).catch((err) => console.error("[Notifications]", err.message));

  res.json({
    success: true,
    message: "Subscription activated successfully",
    data: {
      plan: planName,
      billingCycle: subscription.billingCycle,
      amount: amountPaid,
      renewalDate,
      invoiceNumber,
      offerApplied: bonusMonths > 0,
      bonusMonths: bonusMonths > 0 ? bonusMonths : undefined,
      offerMessage:
        bonusMonths > 0
          ? `Congratulations! ${bonusMonths} bonus month(s) added to your subscription.`
          : undefined,
    },
  });
}

/** POST /billing/verify-payment — verifies the Razorpay payment. */
const SAGA_PRODUCT = "NestAcademy subscription";

// Payment is already taken when these run. If anything below fails: undo what was written, refund the
// customer (utils/paymentSaga.js) and tell them so. Ownership errors (403) are not the customer's money at stake.
async function _withRefundSaga(args, steps) {
  const { update, invoiceExtra, req, res } = args;
  const saga = new Saga();
  try {
    return await steps({ ...args, saga });
  } catch (err) {
    if (res.statusCode === 403 || res.headersSent) throw err;
    res.status(409);
    const undone = await saga.rollback();
    await refundAfterFailure(
      {
        gateway: "razorpay",
        paymentId: update.razorpayPaymentId,
        orderId: invoiceExtra?.razorpayOrderId,
        amount: saga.amount,
        product: SAGA_PRODUCT,
        userId: req.user?._id,
      },
      err,
      undone,
    );
  }
}
const _createCompanyAndActivate = (args) => _withRefundSaga(args, _createCompanyAndActivateSteps);
const _activateSubscription = (args) => _withRefundSaga(args, _activateSubscriptionSteps);

// Activates a paid Razorpay order without a signed-in browser (used when only the webhook told us about the payment).
// Same code path as the browser's verify call, so the saga/refund protection is identical.
async function provisionRazorpay({ orderId, paymentId }) {
  const res = {
    statusCode: 200,
    headersSent: false,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json() {
      this.headersSent = true;
      return this;
    },
  };
  const update = { razorpayPaymentId: paymentId, paymentMethod: "razorpay", paymentStatus: "completed" };
  const invoiceExtra = { razorpayOrderId: orderId, razorpayPaymentId: paymentId };
  const pendingOrder = await PendingOrder.findOne({ orderId });
  if (pendingOrder) {
    const user = await User.findById(pendingOrder.user);
    if (!user) throw new Error("The user who started this order no longer exists");
    return _createCompanyAndActivate({ pendingOrder, req: { user }, update, invoiceExtra, res });
  }
  return _activateSubscription({ req: {}, lookup: { razorpayOrderId: orderId }, update, invoiceExtra, res });
}

const verifyPayment = asyncHandler(async (req, res) => {
  if (!req.body.razorpayOrderId) {
    res.status(400);
    throw new Error("razorpayOrderId is required");
  }
  return verifyRazorpayPayment(req, res);
});

module.exports = {
  getPlans,
  getSubscription,
  getInvoices,
  createOrder,
  validateOfferCode,
  verifyPayment,
  verifyRazorpayPayment,
  provisionRazorpay,
};
