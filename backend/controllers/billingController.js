const asyncHandler = require("express-async-handler");
const { Saga, refundAfterFailure } = require("../utils/paymentSaga");
const crypto = require("crypto");
const Company = require("../models/Company");
const Employee = require("../models/Employee");
const Student = require("../models/Student");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const Counter = require("../models/Counter");
const User = require("../models/User");
const OfferCode = require("../models/OfferCode");
const PendingOrder = require("../models/PendingOrder");
const cashfreeService = require("../services/cashfreeService");
const { sendPaymentConfirmations } = require("../services/notificationService");
const {
  PLANS,
  PLAN_NAME,
  GST_RATE,
  getPlan,
  planForStudents,
  calculatePricing,
} = require("../utils/pricing");
const { lookupAndValidateOffer } = require("../utils/offerCode");
const { invalidateCompanyAccess } = require("../utils/subscriptionStatus");

// Company-level SaaS billing (what an academy pays NestAcademy): three fixed yearly plans chosen by student
// count (utils/pricing.js) + 18% GST. Staff are not billed; WhatsApp runs on prepaid credits.
//
// createOrder stores a PendingOrder. New signup: the Company, Subscription and Invoice are created only after the
// gateway payment is verified. Existing academy (renewal/upgrade): its live Subscription is left untouched until
// the payment is verified, so abandoning checkout never locks the academy out.

/** GET /billing/plans — public; the fixed yearly plans with GST worked out. */
const getPlans = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: PLANS.map((p) => {
      const gst = Math.round((p.price * GST_RATE) / 100);
      return {
        id: p.id,
        name: p.name,
        maxStudents: p.maxStudents >= 1000000 ? null : p.maxStudents, // null = unlimited
        price: p.price,
        gst,
        total: p.price + gst,
        billingCycle: "yearly",
      };
    }),
    gstRate: GST_RATE,
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
  const [currentEmployeeCount, currentStudentCount] = await Promise.all([
    Employee.countDocuments({ company: company._id, status: "active" }),
    Student.countDocuments({ company: company._id, status: "active" }),
  ]);
  res.json({
    success: true,
    data: {
      ...subscription.toObject(),
      currentEmployeeCount,
      currentStudentCount,
      recommendedPlan: planForStudents(currentStudentCount).id,
    },
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
    return `Offer code applied! The plan now costs ₹${offer.flatRate} (before GST).`;
  }
  return `Offer code applied! ${offer.percentOff}% off your order.`;
}

/**
 * POST /billing/validate-offer — checks an offer code and returns a price
 * preview for the chosen plan. Creates nothing and does not consume a use.
 */
const validateOfferCode = asyncHandler(async (req, res) => {
  const { code, planId } = req.body;
  if (!code) {
    res.status(400);
    throw new Error("Offer code is required");
  }

  const offer = await _lookupAndCheckOffer(code, res);
  const preview = getPlan(planId) ? calculatePricing(planId, offer) : null;

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
 * client total) and opens a payment order on Cashfree.
 * Body: planId ("starter" | "growth" | "unlimited"), offerCode, and `company` details for a first-time signup.
 */
const createOrder = asyncHandler(async (req, res) => {
  const { planId, offerCode, company: companyDetails } = req.body;

  const plan = getPlan(planId);
  if (!plan) {
    res.status(400);
    throw new Error("Please choose a plan");
  }

  const existingCompany = await Company.findOne({ createdBy: req.user._id });

  // An academy can only pick a plan that fits the students it already has.
  if (existingCompany) {
    const active = await Student.countDocuments({
      company: existingCompany._id,
      status: "active",
    });
    if (active > plan.maxStudents) {
      res.status(400);
      throw new Error(
        `You have ${active} active students, which is more than the ${plan.name} plan allows (${plan.maxStudents}). Choose a bigger plan.`,
      );
    }
  }

  let validatedOffer = null;
  if (offerCode) {
    validatedOffer = await _lookupAndCheckOffer(offerCode, res);
  }
  const pricing = calculatePricing(plan.id, validatedOffer);

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

  const result = await cashfreeService.createOrder({
    amount: pricing.yearlyPrice,
    customer: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone:
        req.user.phone ||
        (existingCompany ? existingCompany.phone : companyDetails?.phone),
    },
    notes: {
      kind: "subscription",
      planId: plan.id,
      userId: req.user._id.toString(),
      companyId: existingCompany ? existingCompany._id.toString() : "",
    },
  });

  await PendingOrder.create({
    orderId: result.orderId,
    gateway: "cashfree",
    user: req.user._id,
    company: existingCompany ? existingCompany._id : undefined,
    planId: plan.id,
    maxStudents: plan.maxStudents,
    companyName: (existingCompany || newCompanyDetails).name,
    companyEmail: (existingCompany || newCompanyDetails).email,
    companyPhone: (existingCompany || newCompanyDetails).phone,
    website: newCompanyDetails?.website,
    gstNumber: newCompanyDetails?.gstNumber,
    panNumber: newCompanyDetails?.panNumber,
    address: newCompanyDetails?.address,
    city: newCompanyDetails?.city,
    state: newCompanyDetails?.state,
    pincode: newCompanyDetails?.pincode,
    billingCycle: "yearly",
    yearlyPrice: pricing.yearlyPrice,
    gstRate: pricing.gstRate,
    subtotal: pricing.yearlySubtotal,
    gstAmount: pricing.yearlyGstAmount,
    offerCode: validatedOffer ? validatedOffer.code : null,
    offerBonusMonths: validatedOffer ? validatedOffer.bonusMonths : 0,
  });

  res.json({
    success: true,
    data: {
      gateway: "cashfree",
      orderId: result.orderId,
      paymentSessionId: result.paymentSessionId,
      checkoutUrl: result.checkoutUrl,
      mode: result.mode,
      amount: pricing.yearlyPrice,
      subtotal: pricing.yearlySubtotal,
      gstRate: pricing.gstRate,
      gstAmount: pricing.yearlyGstAmount,
      currency: "INR",
      planId: plan.id,
      plan: plan.name,
      maxStudents: plan.maxStudents >= 1000000 ? null : plan.maxStudents,
      billingCycle: "yearly",
      companyName: (existingCompany || newCompanyDetails).name,
      userName: req.user.name,
      userEmail: req.user.email,
      userPhone:
        req.user.phone ||
        (existingCompany ? existingCompany.phone : newCompanyDetails.phone) ||
        "",
      offerApplied: !!validatedOffer,
      bonusMonths: validatedOffer ? validatedOffer.bonusMonths : 0,
    },
  });
});

/**
 * POST /billing/verify-cashfree — asks Cashfree whether the order is really paid, then
 * activates the subscription (creating the company on first purchase).
 */
const verifyCashfreePayment = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) {
    res.status(400);
    throw new Error("orderId is required");
  }

  // Cashfree is asked directly, so the client cannot fake a payment.
  const pay = await cashfreeService.verifyOrder(orderId);
  if (!pay.paid) {
    res.status(402);
    throw new Error("Payment not completed yet");
  }
  // Legacy DB field names (razorpay*) hold the Cashfree ids.
  const razorpayOrderId = orderId;
  const razorpayPaymentId = pay.paymentId;

  const pendingOrder = await PendingOrder.findOne({ orderId });
  const args = {
    pendingOrder,
    req,
    update: {
      razorpayPaymentId,
      paymentMethod: "cashfree",
      paymentStatus: "completed",
    },
    invoiceExtra: { razorpayOrderId, razorpayPaymentId },
    res,
  };
  if (pendingOrder) {
    await (pendingOrder.company
      ? _activateSubscription(args)
      : _createCompanyAndActivate(args));
    return;
  }

  // No pending order: either already processed (replayed verify) or not ours.
  const done = await Subscription.findOne({ razorpayOrderId });
  if (!done || String(done.company) !== String(req.user?.company)) {
    res.status(404);
    throw new Error("Order not found. Please contact support.");
  }
  res.json({
    success: true,
    message: "This payment was already processed.",
    data: {
      plan: done.plan,
      billingCycle: done.billingCycle,
      renewalDate: done.renewalDate,
    },
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
  res,
  saga,
}) {
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

  const amountPaid = pendingOrder.yearlyPrice;
  saga.amount = amountPaid;

  const startDate = new Date();
  const renewalDate = new Date();
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  const bonusMonths = pendingOrder.offerBonusMonths || 0;
  if (bonusMonths > 0) {
    renewalDate.setMonth(renewalDate.getMonth() + bonusMonths);
  }

  const planName = PLAN_NAME;

  const subscription = await saga.create(Subscription, {
    company: company._id,
    plan: planName,
    planId: pendingOrder.planId,
    yearlyPrice: pendingOrder.yearlyPrice,
    gstRate: pendingOrder.gstRate,
    subtotal: pendingOrder.subtotal,
    gstAmount: pendingOrder.gstAmount,
    maxStudents: pendingOrder.maxStudents,
    maxEmployees: 0, // staff are not billed (0 = unlimited)
    billingCycle: "yearly",
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
  await saga.patch(User, req.user._id, {
    company: company._id,
    ...(req.user.phone ? { phone: req.user.phone } : {}),
  });

  let offerCodeDoc = null;
  if (pendingOrder.offerCode) {
    offerCodeDoc = await saga.inc(
      OfferCode,
      { code: pendingOrder.offerCode },
      "usedCount",
      1,
    );
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
    billingCycle: "yearly",
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
    : "https://academy.pixelatenest.com/";

  require("../services/creditsService")
    .onSubscriptionPaid(company._id, subscription)
    .catch((err) => console.error("[Credits]", err.message));
  sendPaymentConfirmations({
    toEmail: req.user.email || company.email,
    toName: req.user.name || company.name,
    toPhone: req.user.phone || company.phone || "",
    companyName: company.name,
    planName: planName,
    amount: amountPaid,
    billingCycle: "yearly",
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
      billingCycle: "yearly",
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

// Renewal / upgrade: applies a verified PendingOrder to the academy's existing Subscription. The new year is added
// after any time still left (an early renewal or upgrade never loses days), then the Invoice is issued.
async function _activateSubscriptionSteps({
  pendingOrder,
  update,
  invoiceExtra,
  res,
  req,
  saga,
}) {
  if (
    req?.user &&
    String(pendingOrder.company) !== String(req.user.company)
  ) {
    res.status(403);
    throw new Error("This order does not belong to your academy.");
  }

  const company = await Company.findById(pendingOrder.company);
  if (!company) {
    res.status(404);
    throw new Error("Company not found");
  }
  const subscription = await Subscription.findOne({ company: company._id });

  const amountPaid = pendingOrder.yearlyPrice;
  saga.amount = amountPaid;

  const now = new Date();
  const stillLive =
    subscription &&
    !subscription.isTrial &&
    subscription.status === "active" &&
    subscription.paymentStatus === "completed" &&
    subscription.renewalDate > now;
  const startDate = now;
  const renewalDate = new Date(stillLive ? subscription.renewalDate : now);
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  const bonusMonths = pendingOrder.offerBonusMonths || 0;
  if (bonusMonths > 0) renewalDate.setMonth(renewalDate.getMonth() + bonusMonths);

  const fields = {
    plan: PLAN_NAME,
    planId: pendingOrder.planId,
    yearlyPrice: pendingOrder.yearlyPrice,
    gstRate: pendingOrder.gstRate,
    subtotal: pendingOrder.subtotal,
    gstAmount: pendingOrder.gstAmount,
    maxStudents: pendingOrder.maxStudents,
    maxEmployees: 0,
    billingCycle: "yearly",
    isTrial: false,
    startDate,
    renewalDate,
    status: "active",
    amountPaid,
    offerCode: pendingOrder.offerCode,
    offerBonusMonths: pendingOrder.offerBonusMonths,
    razorpayOrderId: invoiceExtra.razorpayOrderId, // legacy field name: holds the Cashfree order id
    ...update,
  };
  const sub = subscription
    ? (await saga.patch(Subscription, subscription._id, fields),
      await Subscription.findById(subscription._id))
    : await saga.create(Subscription, { company: company._id, ...fields });

  let offerCodeDoc = null;
  if (pendingOrder.offerCode) {
    offerCodeDoc = await saga.inc(
      OfferCode,
      { code: pendingOrder.offerCode },
      "usedCount",
      1,
    );
  }

  await saga.patch(Company, company._id, {
    status: "active",
    subscription: sub._id,
  });

  const invoiceSeq = await Counter.next("sportsInvoice", () =>
    Invoice.countDocuments(),
  );
  const invoiceNumber = `INV-SPORTS-${String(invoiceSeq).padStart(4, "0")}`;
  await saga.create(Invoice, {
    company: company._id,
    subscription: sub._id,
    invoiceNumber,
    plan: PLAN_NAME,
    billingCycle: "yearly",
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
  invalidateCompanyAccess(company._id); // the paywall cache must see the renewal straight away

  const user = await User.findById(company.createdBy);
  const dashboardUrl = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/`
    : "https://academy.pixelatenest.com/";

  require("../services/creditsService")
    .onSubscriptionPaid(company._id, sub)
    .catch((err) => console.error("[Credits]", err.message));
  sendPaymentConfirmations({
    toEmail: user?.email || company.email,
    toName: user?.name || company.name,
    toPhone: user?.phone || company.phone || "",
    companyName: company.name,
    planName: PLAN_NAME,
    amount: amountPaid,
    billingCycle: "yearly",
    renewalDate,
    dashboardUrl,
    invoiceNumber,
  }).catch((err) => console.error("[Notifications]", err.message));

  res.json({
    success: true,
    message: "Subscription activated successfully",
    data: {
      plan: PLAN_NAME,
      billingCycle: "yearly",
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
        gateway: "cashfree",
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
const _createCompanyAndActivate = (args) =>
  _withRefundSaga(args, _createCompanyAndActivateSteps);
const _activateSubscription = (args) =>
  _withRefundSaga(args, _activateSubscriptionSteps);

// Activates a paid Cashfree order without a signed-in browser (used when only the webhook told us about the payment).
// Same code path as the browser's verify call, so the saga/refund protection is identical.
async function provisionCashfree({ orderId, paymentId }) {
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
  const update = {
    razorpayPaymentId: paymentId,
    paymentMethod: "cashfree",
    paymentStatus: "completed",
  };
  const invoiceExtra = {
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
  };
  const pendingOrder = await PendingOrder.findOne({ orderId });
  if (!pendingOrder) throw new Error("No pending order for " + orderId);
  const user = await User.findById(pendingOrder.user);
  if (!user)
    throw new Error("The user who started this order no longer exists");
  const args = { pendingOrder, req: { user }, update, invoiceExtra, res };
  return pendingOrder.company
    ? _activateSubscription(args)
    : _createCompanyAndActivate(args);
}

const verifyPayment = asyncHandler(async (req, res) => {
  if (!req.body.orderId) {
    res.status(400);
    throw new Error("orderId is required");
  }
  return verifyCashfreePayment(req, res);
});

module.exports = {
  getPlans,
  getSubscription,
  getInvoices,
  createOrder,
  validateOfferCode,
  verifyPayment,
  verifyCashfreePayment,
  provisionCashfree,
};
