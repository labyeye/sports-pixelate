const cfg = require("../config/credits");
const CreditWallet = require("../models/CreditWallet");
const CreditLedger = require("../models/CreditLedger");
const CreditTopup = require("../models/CreditTopup");
const Counter = require("../models/Counter");
const Company = require("../models/Company");
const razorpay = require("./razorpayService");

const U = cfg.UNIT;
const toUnits = (c) => Math.round(c * U);
const toCredits = (u) => u / U;
const round2 = (n) => Math.round(n * 100) / 100;
const istDay = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const mask = (p) => {
  const d = String(p || "").replace(/\D/g, "");
  return d.length > 6 ? `${d.slice(0, 2)}******${d.slice(-4)}` : "****";
};

/** True when this company pays for WhatsApp with credits. No wallet = not metered = free, as before. */
async function isMetered(companyId) {
  if (!companyId) return false;
  return !!(await CreditWallet.exists({ company: companyId, metered: true }));
}

function activeBonus(w) {
  return w.bonusExpiresAt && w.bonusExpiresAt > new Date() ? w.bonusBalance || 0 : 0;
}

/**
 * Take the price of one message BEFORE sending it. Atomic: the balance check is part of the update filter,
 * so two parallel sends can never spend the same credit. Bonus credits are spent first.
 * Returns { ok:true, free:true } (not metered), { ok:true, ledgerId, ... } (charged) or { ok:false, reason }.
 */
async function reserve(companyId, { template, phone }) {
  const w = await CreditWallet.findOne({ company: companyId, metered: true }).select("dailyCap dayKey").lean();
  if (!w) return { ok: true, free: true };

  const cost = toUnits(cfg.RATES[template] ?? cfg.DEFAULT_RATE);
  const key = istDay();
  if (w.dayKey !== key) await CreditWallet.updateOne({ _id: w._id, dayKey: { $ne: key } }, { $set: { dayKey: key, dayCount: 0 } });
  const cap = { dayCount: { $lt: w.dailyCap || cfg.DAILY_CAP } };

  let bucket = "bonus";
  let r = await CreditWallet.updateOne(
    { _id: w._id, ...cap, bonusBalance: { $gte: cost }, bonusExpiresAt: { $gt: new Date() } },
    { $inc: { bonusBalance: -cost, dayCount: 1 } },
  );
  if (!r.modifiedCount) {
    bucket = "main";
    r = await CreditWallet.updateOne({ _id: w._id, ...cap, balance: { $gte: cost } }, { $inc: { balance: -cost, dayCount: 1 } });
  }
  if (!r.modifiedCount) {
    const cur = await CreditWallet.findById(w._id).select("dayCount dailyCap").lean();
    const reason = cur.dayCount >= (cur.dailyCap || cfg.DAILY_CAP) ? "daily_cap" : "low_balance";
    await CreditLedger.create({ company: companyId, type: "skipped", units: 0, event: template, phone: mask(phone), status: "skipped", note: reason });
    checkLow(companyId).catch(() => {});
    return { ok: false, reason };
  }

  try {
    const row = await CreditLedger.create({ company: companyId, type: "debit", units: -cost, bucket, event: template, phone: mask(phone), status: "reserved" });
    checkLow(companyId).catch(() => {});
    return { ok: true, ledgerId: row._id };
  } catch (e) {
    // could not record the debit: give the credit back rather than charge without a trace
    await CreditWallet.updateOne({ _id: w._id }, { $inc: bucket === "bonus" ? { bonusBalance: cost } : { balance: cost } });
    throw e;
  }
}

/** Meta accepted the message: remember its id so a later "failed" delivery status can refund it. */
async function commit(hold, wamid) {
  if (!hold || hold.free || !hold.ledgerId) return;
  await CreditLedger.updateOne({ _id: hold.ledgerId, status: "reserved" }, { $set: { status: "sent", wamid: wamid || undefined } });
}

async function refundWhere(filter, note) {
  // flipping status is the claim: a second refund attempt finds nothing to flip
  const row = await CreditLedger.findOneAndUpdate({ ...filter, type: "debit", status: { $in: ["reserved", "sent"] } }, { $set: { status: "refunded", note } });
  if (!row) return false;
  await CreditWallet.updateOne({ company: row.company }, { $inc: row.bucket === "bonus" ? { bonusBalance: -row.units } : { balance: -row.units } });
  await CreditLedger.create({ company: row.company, type: "refund", units: -row.units, bucket: row.bucket, event: row.event, phone: row.phone, refId: `refund:${row._id}`, note });
  return true;
}

/** Message was never sent (Meta rejected it / network error). */
const refund = (hold, note = "send_failed") => (hold && hold.ledgerId ? refundWhere({ _id: hold.ledgerId }, note) : false);
/** Meta told us afterwards that delivery failed. */
const refundByWamid = (wamid, note = "delivery_failed") => (wamid ? refundWhere({ wamid }, note) : false);

async function getBalance(companyId) {
  const w = await CreditWallet.findOne({ company: companyId }).lean();
  if (!w || !w.metered) return { metered: false };
  const bonus = activeBonus(w);
  const total = w.balance + bonus;
  return {
    metered: true,
    balance: toCredits(w.balance),
    bonus: toCredits(bonus),
    bonusExpiresAt: bonus ? w.bonusExpiresAt : null,
    total: toCredits(total),
    low: total < toUnits(cfg.LOW_BALANCE_CREDITS),
    zero: total <= 0,
    dailyCap: w.dailyCap || cfg.DAILY_CAP,
    ratePerMessage: cfg.DEFAULT_RATE,
  };
}

/** Free credits (subscription bonus, manual gift). refId makes it safe to call twice. Bonus bucket expires. */
async function grantBonus(companyId, { credits, days = cfg.BONUS_DAYS, refId, note }) {
  const units = toUnits(credits);
  try {
    await CreditLedger.create({ company: companyId, type: "bonus", units, bucket: "bonus", refId, note });
  } catch (e) {
    if (e.code === 11000) return false; // already granted
    throw e;
  }
  const expires = new Date(Date.now() + days * 86400000);
  await CreditWallet.updateOne(
    { company: companyId },
    { $inc: { bonusBalance: units }, $set: { alerted: null }, $max: { bonusExpiresAt: expires } },
    { upsert: true },
  );
  return true;
}

/** Turn metering on for a company (creates the wallet). */
async function enable(companyId) {
  await CreditWallet.updateOne({ company: companyId }, { $set: { metered: true }, $setOnInsert: { balance: 0, bonusBalance: 0 } }, { upsert: true });
}

/** Called when a subscription payment completes. New metered companies get the plan's bonus once per subscription. */
async function onSubscriptionPaid(companyId, subscription) {
  if (!subscription) return;
  if (process.env.CREDITS_FOR_NEW_SIGNUPS === "true" && !(await CreditWallet.exists({ company: companyId }))) await enable(companyId);
  if (!(await isMetered(companyId))) return;
  await grantBonus(companyId, {
    credits: cfg.bonusFor(subscription),
    refId: `sub:${subscription._id}:${subscription.renewalDate ? new Date(subscription.renewalDate).toISOString().slice(0, 10) : ""}`, // once per paid period
    note: `Subscription bonus (${subscription.plan})`,
  });
}

// ---- top-up (Razorpay) ------------------------------------------------------

async function createTopup(user, packId) {
  const pack = cfg.PACKS.find((p) => p.id === packId);
  if (!pack) throw Object.assign(new Error("Unknown credit pack"), { status: 400 });
  if (!(await isMetered(user.company))) throw Object.assign(new Error("Credits are not enabled for your company"), { status: 400 });
  const gst = round2((pack.price * cfg.GST_PCT) / 100);
  const total = round2(pack.price + gst);
  const order = await razorpay.createOrder({ amount: total, receipt: `cr_${Date.now()}`, notes: { kind: "credits", company: String(user.company) } });
  await CreditTopup.create({ company: user.company, user: user._id, packId, credits: pack.credits, price: pack.price, gst, total, orderId: order.orderId });
  return { ...order, pack: { ...pack, gst, total } };
}

/**
 * Credit the wallet for a paid order. Called by the browser verify call AND the Razorpay webhook; whichever
 * arrives first wins the atomic created->paid flip, the other one is a no-op.
 * ponytail: a process crash between the flip and the wallet update loses that top-up; reconcile by hand from Razorpay.
 */
async function completeTopup({ orderId, paymentId }) {
  const t = await CreditTopup.findOneAndUpdate({ orderId, status: "created" }, { $set: { status: "paid", paymentId, paidAt: new Date() } }, { new: true });
  if (!t) return null;
  try {
    const seq = await Counter.next("invoice-academy-credits", () => CreditTopup.countDocuments({ invoiceNumber: { $exists: true } }));
    t.invoiceNumber = `CR-ACAD-${String(seq).padStart(4, "0")}`;
    await t.save();
    await CreditWallet.updateOne({ company: t.company }, { $inc: { balance: toUnits(t.credits) }, $set: { alerted: null } });
  } catch (e) {
    await CreditTopup.updateOne({ _id: t._id }, { $set: { status: "created" } }); // nothing credited yet: let a retry run
    throw e;
  }
  await CreditLedger.create({ company: t.company, type: "topup", units: toUnits(t.credits), bucket: "main", refId: paymentId, note: `${t.invoiceNumber} (Rs ${t.total} incl. GST)` }).catch((e) =>
    console.error("[Credits] topup credited but ledger row failed:", e.message),
  );
  return t;
}

// ---- low balance alert ------------------------------------------------------

async function checkLow(companyId) {
  const w = await CreditWallet.findOne({ company: companyId, metered: true }).lean();
  if (!w) return;
  const total = w.balance + activeBonus(w);
  const level = total <= 0 ? "zero" : total < toUnits(cfg.LOW_BALANCE_CREDITS) ? "low" : null;
  if (!level || w.alerted === level) return;
  // only one worker wins this flip, so one email per level
  const flip = await CreditWallet.updateOne({ _id: w._id, alerted: w.alerted ?? null }, { $set: { alerted: level } });
  if (!flip.modifiedCount) return;
  const company = await Company.findById(companyId).select("name email");
  if (!company?.email) return;
  await require("./notificationService").sendLowCreditsEmail({ to: company.email, name: company.name, credits: toCredits(Math.max(total, 0)), zero: level === "zero" });
}

module.exports = { toUnits, toCredits, isMetered, reserve, commit, refund, refundByWamid, getBalance, grantBonus, enable, onSubscriptionPaid, createTopup, completeTopup };
