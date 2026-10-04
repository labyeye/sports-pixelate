const crypto = require("crypto");
const PaymentLink = require("../models/PaymentLink");
const StudentSubscription = require("../models/StudentSubscription");
const Company = require("../models/Company");
const Setting = require("../models/Setting");
const paymentGatewayService = require("./paymentGatewayService");
const { sendFeePaymentLink } = require("./whatsappService");

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const LINK_TTL_DAYS = 30;
const MAX_SEND_ATTEMPTS = 3;

const frontendUrl = () =>
  process.env.FRONTEND_URL || "https://sports.pixelatenest.com";
const linkUrl = (token) => `${frontendUrl()}/pay/${token}`;

const istShift = (d = new Date()) => new Date(d.getTime() + IST_OFFSET_MS);
const monthKey = (d = new Date()) => {
  const ist = istShift(d);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
};
// Last instant of the current IST month, as a real (UTC) Date.
const endOfIstMonth = (d = new Date()) => {
  const ist = istShift(d);
  return new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 1) - IST_OFFSET_MS - 1,
  );
};

// What (if anything) a subscription owes right now.
//  - unpaid amount on the current period  -> "balance"
//  - fully paid but the next period is due this month (or already lapsed)
//    -> "renewal", at the plan's current price
// Returns null when there is nothing to collect.
function computeDue(sub, plan, now = new Date()) {
  if (!["active", "pending_renewal"].includes(sub.status)) return null;

  const unpaid = (sub.amount || 0) - (sub.amountPaid || 0);
  if (sub.paymentStatus !== "completed" && unpaid > 0) {
    return { type: "balance", amount: unpaid };
  }

  const dueThisMonth =
    sub.status === "pending_renewal" ||
    new Date(sub.renewalDate) <= endOfIstMonth(now);
  if (!dueThisMonth) return null;

  const price =
    sub.billingCycle === "yearly" ? plan?.yearlyPrice : plan?.monthlyPrice;
  const amount = price || sub.amount;
  return amount > 0 ? { type: "renewal", amount } : null;
}

// Creates (idempotently) this month's link for every student with a fee due.
async function ensureMonthlyLinks(companyId, now = new Date()) {
  const month = monthKey(now);
  const subs = await StudentSubscription.find({
    company: companyId,
    status: { $in: ["active", "pending_renewal"] },
  })
    .sort({ createdAt: -1 })
    .populate("student", "firstName lastName status guardians")
    .populate("plan", "monthlyPrice yearlyPrice")
    .lean();

  const seen = new Set();
  const stats = { created: 0, existing: 0, nothingDue: 0, noGuardian: 0 };
  for (const sub of subs) {
    const student = sub.student;
    if (!student || (student.status && student.status !== "active")) continue;
    if (seen.has(String(student._id))) continue; // newest subscription only
    seen.add(String(student._id));

    const due = computeDue(sub, sub.plan, now);
    if (!due) {
      stats.nothingDue++;
      continue;
    }
    const guardian = (student.guardians || []).find(
      (g) => g.receivesWhatsapp && g.phone,
    );
    if (!guardian) {
      stats.noGuardian++;
      continue;
    }

    const res = await PaymentLink.updateOne(
      { subscription: sub._id, month },
      {
        $setOnInsert: {
          company: companyId,
          student: student._id,
          subscription: sub._id,
          month,
          token: crypto.randomBytes(24).toString("base64url"),
          type: due.type,
          amount: due.amount,
          planName: sub.planName,
          guardianName: guardian.name,
          guardianPhone: guardian.phone,
          expiresAt: new Date(now.getTime() + LINK_TTL_DAYS * 86400000),
        },
      },
      { upsert: true },
    );
    if (res.upsertedCount) stats.created++;
    else stats.existing++;
  }
  return stats;
}

// Sends every link for this month that has not gone out yet.
async function sendPendingLinks(companyId, now = new Date()) {
  const links = await PaymentLink.find({
    company: companyId,
    month: monthKey(now),
    status: "pending",
    sentAt: null,
    sendAttempts: { $lt: MAX_SEND_ATTEMPTS },
  }).populate("student", "firstName lastName");

  const stats = { sent: 0, skipped: 0, failed: 0 };
  for (const link of links) {
    const result = await sendFeePaymentLink(
      link.guardianPhone,
      {
        guardianName: link.guardianName,
        studentName: `${link.student?.firstName || ""} ${link.student?.lastName || ""}`.trim(),
        planName: link.planName,
        amount: link.amount,
        url: linkUrl(link.token),
      },
      companyId,
    );
    if (result.status === "sent") {
      link.sentAt = new Date();
      link.lastError = undefined;
      stats.sent++;
    } else {
      // "skipped" (WhatsApp off) is not a delivery attempt worth burning.
      if (result.status === "failed") link.sendAttempts += 1;
      link.lastError = result.error;
      stats[result.status]++;
    }
    await link.save();
  }
  return stats;
}

// ---------------------------------------------------------------- public pay

async function loadLink(token) {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) {
    return null;
  }
  const link = await PaymentLink.findOne({ token });
  if (!link) return null;
  if (link.status === "pending" && link.expiresAt < new Date()) {
    link.status = "expired";
    await link.save();
  }
  return link;
}

// Re-checks what is owed at the moment of use — the balance may have been
// paid in person since the link was sent. Returns the (possibly updated)
// link, or null when nothing is due any more.
async function refreshDue(link) {
  const sub = await StudentSubscription.findById(link.subscription).populate(
    "plan",
    "monthlyPrice yearlyPrice",
  );
  const due = sub ? computeDue(sub, sub.plan) : null;
  if (!due) return { sub, due: null };
  if (due.type !== link.type || due.amount !== link.amount) {
    link.type = due.type;
    link.amount = due.amount;
    await link.save();
  }
  return { sub, due };
}

async function getPublicDetails(token) {
  const link = await loadLink(token);
  if (!link) return null;
  const [company, setting, student] = await Promise.all([
    Company.findById(link.company).select("name"),
    Setting.findOne({ company: link.company }).select("companyName").lean(),
    require("../models/Student")
      .findById(link.student)
      .select("firstName lastName"),
  ]);

  let status = link.status;
  if (status === "pending") {
    const { due } = await refreshDue(link);
    if (!due) status = "settled"; // paid some other way meanwhile
  }
  return {
    status, // pending | paid | expired | settled
    academyName: setting?.companyName || company?.name || "Your academy",
    studentName: student ? `${student.firstName} ${student.lastName}` : "",
    planName: link.planName,
    amount: link.amount,
    type: link.type,
    paidAt: link.paidAt,
    expiresAt: link.expiresAt,
  };
}

async function startPayment(token) {
  const { getCompanyPaymentCreds } = require("../controllers/subscriptionController");
  const link = await loadLink(token);
  if (!link) return { error: "Payment link not found", code: 404 };
  if (link.status === "paid") return { error: "This fee is already paid", code: 409 };
  if (link.status === "expired") {
    return { error: "This payment link has expired", code: 410 };
  }
  const { due } = await refreshDue(link);
  if (!due) return { error: "Nothing is due on this plan any more", code: 409 };

  const { gateway, creds } = await getCompanyPaymentCreds(link.company);
  if (!creds) {
    return {
      error:
        "This academy hasn't set up online payments yet. Please pay at the academy.",
      code: 400,
    };
  }

  const orderId = `plink_${link._id.toString().slice(-8)}_${Date.now()}`;
  const result = await paymentGatewayService.createOrder(gateway, creds, {
    amount: link.amount,
    orderId,
    customer: {
      id: link.student.toString(),
      name: link.guardianName || "Guardian",
      phone: link.guardianPhone,
      email: undefined,
    },
    returnUrl: `${frontendUrl()}/pay/${link.token}?return=1`,
  });

  link.gateway = gateway;
  link.orderId = result.orderId;
  await link.save();

  return {
    data: {
      gateway: result.gateway,
      checkoutMode: result.checkoutMode,
      orderId: result.orderId,
      keyId: result.keyId,
      appId: result.appId,
      paymentSessionId: result.paymentSessionId,
      checkoutUrl: result.checkoutUrl,
      redirectUrl: result.redirectUrl,
      redirectFields: result.redirectFields,
      amount: link.amount,
      currency: "INR",
      planName: link.planName,
    },
  };
}

// Confirms with the gateway itself, then books the payment on the
// subscription. Idempotent: the link is claimed atomically so a reload or a
// double callback can't count the money twice.
async function confirmPayment(token, payload = {}) {
  const {
    getCompanyPaymentCreds,
    recalcSubscriptionTotals,
    notifyPaymentVerified,
  } = require("../controllers/subscriptionController");

  const link = await loadLink(token);
  if (!link) return { error: "Payment link not found", code: 404 };
  if (link.status === "paid") return { data: { status: "paid" } };
  if (!link.orderId) return { error: "No payment was started", code: 400 };
  // Razorpay hands back the order id; it must be the one we created.
  if (payload.razorpayOrderId && payload.razorpayOrderId !== link.orderId) {
    return { error: "Payment does not match this link", code: 400 };
  }

  const { creds } = await getCompanyPaymentCreds(link.company);
  const result = await paymentGatewayService.confirmPayment(
    link.gateway || "razorpay",
    creds,
    link.orderId,
    {
      razorpayOrderId: link.orderId,
      razorpayPaymentId: payload.razorpayPaymentId,
      razorpaySignature: payload.razorpaySignature,
    },
  );
  if (!result.isSuccess) {
    return { error: "Payment verification failed.", code: 400 };
  }

  const claimed = await PaymentLink.findOneAndUpdate(
    { _id: link._id, status: "pending" },
    { $set: { status: "paid", paidAt: new Date() } },
    { new: true },
  );
  if (!claimed) return { data: { status: "paid" } };

  try {
    const sub = await StudentSubscription.findById(link.subscription);
    if (!sub) throw new Error("Subscription not found");

    if (link.type === "renewal") {
      // New period: restart the cycle so earlier payments don't count and
      // recalcSubscriptionTotals rolls the renewal date forward.
      sub.amount = link.amount;
      sub.startDate = new Date();
      sub.amountPaid = 0;
      sub.paymentStatus = "pending";
    }

    const paymentId = payload.razorpayPaymentId || link.orderId;
    sub.razorpayOrderId = link.orderId;
    sub.razorpayPaymentId = paymentId;
    sub.paymentGateway = link.gateway || "razorpay";
    sub.payments.push({
      amount: link.amount,
      method: link.gateway || "razorpay",
      razorpayOrderId: link.orderId,
      razorpayPaymentId: paymentId,
      status: "verified",
      submittedAt: new Date(),
      verifiedAt: new Date(),
    });
    const updated = await recalcSubscriptionTotals(sub);
    await updated.populate("student", "firstName lastName");

    const payment = updated.payments[updated.payments.length - 1];
    const gw = link.gateway || "razorpay";
    notifyPaymentVerified(
      updated,
      payment,
      link.company,
      `${gw[0].toUpperCase()}${gw.slice(1)} (payment link)`,
    );
  } catch (err) {
    // Booking failed after the gateway confirmed — release the claim so the
    // same verify can be retried instead of losing the payment.
    await PaymentLink.updateOne(
      { _id: link._id },
      { $set: { status: "pending" }, $unset: { paidAt: 1 } },
    );
    throw err;
  }
  return { data: { status: "paid" } };
}

module.exports = {
  monthKey,
  istShift,
  computeDue,
  ensureMonthlyLinks,
  sendPendingLinks,
  getPublicDetails,
  startPayment,
  confirmPayment,
};
