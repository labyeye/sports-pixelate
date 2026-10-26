const asyncHandler = require("express-async-handler");
const cfg = require("../config/credits");
const credits = require("../services/creditsService");
const razorpay = require("../services/razorpayService");
const CreditLedger = require("../models/CreditLedger");
const CreditTopup = require("../models/CreditTopup");
const Employee = require("../models/Employee");
const Student = require("../models/Student");
const User = require("../models/User");
const Setting = require("../models/Setting");

const getBalance = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await credits.getBalance(req.user.company) });
});

const getPacks = asyncHandler(async (req, res) => {
  const packs = cfg.PACKS.map((p) => {
    const gst = Math.round(p.price * cfg.GST_PCT) / 100;
    return { ...p, gst, total: p.price + gst, bonus: Math.max(p.credits - p.price, 0) };
  });
  res.json({ success: true, data: { packs, gstPct: cfg.GST_PCT, ratePerMessage: cfg.DEFAULT_RATE } });
});

// Message list: what was charged, to whom, and what was skipped for lack of credits.
const getLedger = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
  const filter = { company: req.user.company };
  if (["topup", "bonus", "debit", "refund", "skipped"].includes(req.query.type)) filter.type = req.query.type;
  const [rows, total] = await Promise.all([
    CreditLedger.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    CreditLedger.countDocuments(filter),
  ]);
  res.json({
    success: true,
    total,
    page,
    data: rows.map((r) => ({ _id: r._id, type: r.type, credits: credits.toCredits(r.units), event: r.event, phone: r.phone, status: r.status, note: r.note, createdAt: r.createdAt })),
  });
});

// What the WhatsApp toggles in Settings cost per day. Every staff punch goes to the staff member and to each
// admin with a phone; every student check-in/out goes to that student's parent/guardian.
const getEstimate = asyncHandler(async (req, res) => {
  const company = req.user.company;
  const hasPhone = { $exists: true, $ne: "" };
  const [setting, employees, students, hrWithPhone] = await Promise.all([
    Setting.findOne({ company }).select("whatsappNotifyCheckIn whatsappSendPunchAlert").lean(),
    Employee.countDocuments({ company, status: "active", phone: hasPhone }),
    Student.countDocuments({ company, status: "active", "guardians.phone": hasPhone }),
    User.countDocuments({ company, role: { $in: ["super_admin", "hr_manager"] }, phone: hasPhone }),
  ]);
  const who = setting?.whatsappSendPunchAlert || "Both";
  const toEmployee = who === "Both" || who === "Employee";
  const toHR = who === "Both" || who === "HR";
  const punchOn = setting?.whatsappNotifyCheckIn !== false && who !== "Off";
  const perPunch = (toEmployee ? 1 : 0) + (toHR ? hrWithPhone : 0);
  const punchMessages = punchOn ? (employees * perPunch + (toEmployee ? students : 0)) * 2 : 0; // check-in + check-out
  res.json({
    success: true,
    data: {
      ratePerMessage: cfg.DEFAULT_RATE,
      employees,
      students,
      hrRecipients: hrWithPhone,
      punch: { messagesPerDay: punchMessages, creditsPerDay: Math.round(punchMessages * cfg.DEFAULT_RATE * 100) / 100 },
    },
  });
});

const createTopup = asyncHandler(async (req, res) => {
  try {
    res.json({ success: true, data: await credits.createTopup(req.user, req.body.packId) });
  } catch (e) {
    res.status(e.status || 500);
    throw e;
  }
});

const verifyTopup = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    res.status(400);
    throw new Error("Missing payment details");
  }
  if (!razorpay.verifySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) {
    res.status(400);
    throw new Error("Payment verification failed. Invalid signature.");
  }
  const order = await CreditTopup.findOne({ orderId: razorpayOrderId }).select("company");
  if (!order || String(order.company) !== String(req.user.company)) {
    res.status(404);
    throw new Error("Order not found");
  }
  await credits.completeTopup({ orderId: razorpayOrderId, paymentId: razorpayPaymentId }); // null = webhook already did it
  res.json({ success: true, data: await credits.getBalance(req.user.company) });
});

const getTopups = asyncHandler(async (req, res) => {
  const rows = await CreditTopup.find({ company: req.user.company, status: "paid" }).sort({ paidAt: -1 }).limit(50).lean();
  res.json({ success: true, data: rows.map((t) => ({ _id: t._id, invoiceNumber: t.invoiceNumber, credits: t.credits, price: t.price, gst: t.gst, total: t.total, paidAt: t.paidAt })) });
});

module.exports = { getBalance, getPacks, getLedger, getEstimate, createTopup, verifyTopup, getTopups };
