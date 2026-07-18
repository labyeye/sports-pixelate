const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const OfferCode = require("../models/OfferCode");
const PendingOrder = require("../models/PendingOrder");
const hdfcPayment = require("../services/hdfcPaymentService");
const razorpayService = require("../services/razorpayService");
const { sendPaymentConfirmations } = require("../services/notificationService");
const { RATE_STANDARD, RATE_WHATSAPP, calculatePricing } = require("../utils/pricing");
const { lookupAndValidateOffer } = require("../utils/offerCode");

const PLAN_NAME = "NestSports";

const getPlans = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: [
      {
        name: PLAN_NAME,
        ratePerUnit: RATE_STANDARD,
        ratePerUnitWhatsapp: RATE_WHATSAPP,
      },
    ],
  });
});

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
  res.json({ success: true, data: subscription });
});

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
    return `Offer code applied! Your rate is now ₹${offer.flatRate}/unit/year.`;
  }
  return `Offer code applied! ${offer.percentOff}% off your order.`;
}

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
  if (!["razorpay", "hdfc"].includes(gateway)) {
    res.status(400);
    throw new Error("Invalid gateway. Use razorpay or hdfc");
  }

  const planName = PLAN_NAME;

  const existingCompany = await Company.findOne({ createdBy: req.user._id });

  // Validate offer code if provided
  let validatedOffer = null;
  if (offerCode) {
    validatedOffer = await _lookupAndCheckOffer(offerCode, res);
  }

  const pricing = calculatePricing(count, empCount, !!wantsWhatsapp, validatedOffer);

  const amountRupees =
    billingCycle === "yearly" ? pricing.yearlyPrice : pricing.monthlyPrice;

  // New signup: no Company exists yet. Company/Subscription are only created
  // once payment is verified — don't touch either collection here.
  let newCompanyDetails = null;
  if (!existingCompany) {
    const { name, email, phone, industry, website, gstNumber, panNumber } =
      companyDetails || {};
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
      industry,
      website,
      gstNumber,
      panNumber,
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
        industry: newCompanyDetails.industry,
        website: newCompanyDetails.website,
        gstNumber: newCompanyDetails.gstNumber,
        panNumber: newCompanyDetails.panNumber,
        studentCount: count,
        employeeCount: empCount,
        wantsWhatsapp: !!wantsWhatsapp,
        billingCycle,
        ratePerUnit: pricing.ratePerUnit,
        monthlyPrice: pricing.monthlyPrice,
        yearlyPrice: pricing.yearlyPrice,
        offerCode: validatedOffer ? validatedOffer.code : null,
        offerBonusMonths: validatedOffer ? validatedOffer.bonusMonths : 0,
      });
    }

    orderData = {
      gateway: "razorpay",
      orderId: result.orderId,
      keyId: result.keyId,
      amount: amountRupees,
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
  } else {
    const orderId = hdfcPayment.generateOrderId();
    const result = await hdfcPayment.createOrder({
      orderId,
      amount: amountRupees,
      currency: "INR",
      customer: {
        name: req.user.name,
        email: req.user.email,
        phone:
          req.user.phone ||
          (existingCompany ? existingCompany.phone : newCompanyDetails.phone) ||
          "",
        address: existingCompany?.address || "India",
        city: existingCompany?.city || "",
        state: existingCompany?.state || "",
        pincode: existingCompany?.pincode || "",
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
          maxStudents: count,
          maxEmployees: empCount,
          billingCycle,
          startDate: new Date(),
          renewalDate: new Date(),
          status: "inactive",
          paymentStatus: "pending",
          paymentMethod: "hdfc_smartgateway",
          amountPaid: 0,
          hdfcOrderId: orderId,
          offerCode: validatedOffer ? validatedOffer.code : null,
          offerBonusMonths: validatedOffer ? validatedOffer.bonusMonths : 0,
        },
        { upsert: true, new: true },
      );
    } else {
      await PendingOrder.create({
        orderId,
        gateway: "hdfc",
        user: req.user._id,
        companyName: newCompanyDetails.name,
        companyEmail: newCompanyDetails.email,
        companyPhone: newCompanyDetails.phone,
        industry: newCompanyDetails.industry,
        website: newCompanyDetails.website,
        gstNumber: newCompanyDetails.gstNumber,
        panNumber: newCompanyDetails.panNumber,
        studentCount: count,
        employeeCount: empCount,
        wantsWhatsapp: !!wantsWhatsapp,
        billingCycle,
        ratePerUnit: pricing.ratePerUnit,
        monthlyPrice: pricing.monthlyPrice,
        yearlyPrice: pricing.yearlyPrice,
        offerCode: validatedOffer ? validatedOffer.code : null,
        offerBonusMonths: validatedOffer ? validatedOffer.bonusMonths : 0,
      });
    }

    orderData = {
      gateway: "hdfc",
      orderId,
      paymentUrl: result.paymentUrl,
      amount: amountRupees,
      currency: "INR",
      studentCount: count,
      employeeCount: empCount,
      wantsWhatsapp: !!wantsWhatsapp,
      ratePerUnit: pricing.ratePerUnit,
      plan: planName,
      billingCycle,
      offerApplied: !!validatedOffer,
      bonusMonths: validatedOffer ? validatedOffer.bonusMonths : 0,
    };
  }

  res.json({ success: true, data: orderData });
});

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

const verifyHdfcPayment = asyncHandler(async (req, res) => {
  const { orderId, trackingId } = req.body;
  if (!orderId) {
    res.status(400);
    throw new Error("orderId is required");
  }

  const verification = await hdfcPayment.verifyPayment({ orderId, trackingId });
  if (!verification.isSuccess) {
    res.status(400);
    throw new Error(
      `Payment not successful. Status: ${verification.status || "unknown"}`,
    );
  }

  const pendingOrder = await PendingOrder.findOne({ orderId });
  if (pendingOrder) {
    await _createCompanyAndActivate({
      pendingOrder,
      req,
      update: {
        hdfcTrackingId: verification.trackingId,
        hdfcBankRefNo: verification.bankRefNo,
        paymentMethod: "hdfc_smartgateway",
        paymentStatus: "completed",
      },
      invoiceExtra: {
        hdfcOrderId: orderId,
        hdfcTrackingId: verification.trackingId,
      },
      res,
    });
    return;
  }

  await _activateSubscription({
    lookup: { hdfcOrderId: orderId },
    update: {
      hdfcTrackingId: verification.trackingId,
      hdfcBankRefNo: verification.bankRefNo,
      paymentMethod: "hdfc_smartgateway",
      paymentStatus: "completed",
    },
    invoiceExtra: {
      hdfcOrderId: orderId,
      hdfcTrackingId: verification.trackingId,
    },
    res,
  });
});

async function _createCompanyAndActivate({
  pendingOrder,
  req,
  update,
  invoiceExtra,
  res,
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

  const company = await Company.create({
    name: pendingOrder.companyName,
    email: pendingOrder.companyEmail,
    phone: pendingOrder.companyPhone,
    password: crypto.randomBytes(16).toString("hex"),
    industry: pendingOrder.industry,
    website: pendingOrder.website,
    gstNumber: pendingOrder.gstNumber,
    panNumber: pendingOrder.panNumber,
    status: "active",
    createdBy: req.user._id,
  });

  const amountPaid =
    pendingOrder.billingCycle === "yearly"
      ? pendingOrder.yearlyPrice
      : pendingOrder.monthlyPrice;

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

  const subscription = await Subscription.create({
    company: company._id,
    plan: planName,
    studentCount: pendingOrder.studentCount,
    employeeCount: pendingOrder.employeeCount,
    wantsWhatsapp: pendingOrder.wantsWhatsapp,
    ratePerUnit: pendingOrder.ratePerUnit,
    monthlyPrice: pendingOrder.monthlyPrice,
    yearlyPrice: pendingOrder.yearlyPrice,
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

  company.subscription = subscription._id;
  await company.save();

  req.user.company = company._id;
  await req.user.save();

  let offerCodeDoc = null;
  if (pendingOrder.offerCode) {
    offerCodeDoc = await OfferCode.findOneAndUpdate(
      { code: pendingOrder.offerCode },
      { $inc: { usedCount: 1 } },
      { new: true },
    );
  }

  const invoiceCount = await Invoice.countDocuments();
  const invoiceNumber = `KHT/HR/${String(invoiceCount + 1).padStart(3, "0")}`;
  await Invoice.create({
    company: company._id,
    subscription: subscription._id,
    invoiceNumber,
    plan: planName,
    billingCycle: pendingOrder.billingCycle,
    amount: amountPaid,
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

  await PendingOrder.deleteOne({ _id: pendingOrder._id });

  const dashboardUrl = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/`
    : "https://hrms.pixelatenest.com/";

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

async function _activateSubscription({ lookup, update, invoiceExtra, res }) {
  const subscription = await Subscription.findOne(lookup);
  if (!subscription) {
    res.status(404);
    throw new Error("Order not found. Please contact support.");
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

  const updatedSub = await Subscription.findByIdAndUpdate(
    subscription._id,
    { startDate, renewalDate, status: "active", amountPaid, ...update },
    { new: true },
  );

  // Record offer code usage (invoiceNumber assigned just below)
  let offerCodeDoc = null;
  if (subscription.offerCode) {
    offerCodeDoc = await OfferCode.findOneAndUpdate(
      { code: subscription.offerCode },
      { $inc: { usedCount: 1 } },
      { new: true },
    );
  }

  await Company.findByIdAndUpdate(company._id, {
    status: "active",
    subscription: updatedSub._id,
  });

  const invoiceCount = await Invoice.countDocuments();
  const invoiceNumber = `KHT/HR/${String(invoiceCount + 1).padStart(3, "0")}`;
  await Invoice.create({
    company: company._id,
    subscription: updatedSub._id,
    invoiceNumber,
    plan: planName,
    billingCycle: subscription.billingCycle,
    amount: amountPaid,
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
    : "https://hrms.pixelatenest.com/";

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

const verifyPayment = asyncHandler(async (req, res) => {
  if (req.body.razorpayOrderId) {
    return verifyRazorpayPayment(req, res);
  }
  return verifyHdfcPayment(req, res);
});

module.exports = {
  getPlans,
  getSubscription,
  getInvoices,
  createOrder,
  validateOfferCode,
  verifyPayment,
  verifyRazorpayPayment,
  verifyHdfcPayment,
};
