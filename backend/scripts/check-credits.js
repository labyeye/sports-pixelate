// Checks for WhatsApp credits against a THROWAWAY Mongo (never the real one).
//   CHECK_MONGO_URI=mongodb://127.0.0.1:27017/credits_check node scripts/check-credits.js
// Needs a real mongod because the point is that parallel sends cannot overspend.
const assert = require("assert");
const path = require("path");
const mongoose = require("mongoose");

const uri = process.env.CHECK_MONGO_URI;
if (!uri || !/credits_check/.test(uri)) {
  console.error("Set CHECK_MONGO_URI to a throwaway database whose name contains credits_check");
  process.exit(1);
}

// no real Razorpay / email in a check
let orderSeq = 0;
const stub = (rel, exports) => {
  const p = require.resolve(path.join("..", rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
const mails = [];
stub("services/razorpayService.js", { createOrder: async ({ amount }) => ({ orderId: `order_${++orderSeq}`, keyId: "k", amount, currency: "INR" }), verifySignature: () => true });
stub("services/notificationService.js", { sendLowCreditsEmail: async (m) => mails.push(m) });

const credits = require("../services/creditsService");
const CreditWallet = require("../models/CreditWallet");
const CreditLedger = require("../models/CreditLedger");
const CreditTopup = require("../models/CreditTopup");

const oid = () => new mongoose.Types.ObjectId();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await Promise.all([CreditWallet.init(), CreditLedger.init(), CreditTopup.init()]);

  // 1. no wallet = not metered = free
  const free = oid();
  assert.deepStrictEqual(await credits.reserve(free, { template: "t", phone: "9199" }), { ok: true, free: true });

  // 2. 20 parallel sends on 1 credit at 0.2 each: exactly 5 get through, balance never negative
  const c = oid();
  await credits.enable(c);
  await CreditWallet.updateOne({ company: c }, { $set: { balance: credits.toUnits(1) } });
  const holds = await Promise.all(Array.from({ length: 20 }, () => credits.reserve(c, { template: "neshr_checkin", phone: "919876543210" })));
  const okHolds = holds.filter((h) => h.ok);
  assert.strictEqual(okHolds.length, 5, "only 5 of 20 may be charged");
  assert.strictEqual((await CreditWallet.findOne({ company: c })).balance, 0);
  assert.strictEqual(await CreditLedger.countDocuments({ company: c, type: "skipped" }), 15, "skipped sends are logged");

  // 3. refund gives the credit back exactly once
  assert.strictEqual(await credits.refund(okHolds[0]), true);
  assert.strictEqual(await credits.refund(okHolds[0]), false, "second refund is a no-op");
  assert.strictEqual((await credits.getBalance(c)).total, 0.2);

  // 4. Meta says "failed" later: refund by message id, once
  const h = await credits.reserve(c, { template: "neshr_checkin", phone: "919876543210" });
  assert(h.ok);
  await credits.commit(h, "wamid.ABC");
  assert.strictEqual((await credits.getBalance(c)).total, 0);
  assert.strictEqual(await credits.refundByWamid("wamid.ABC"), true);
  assert.strictEqual(await credits.refundByWamid("wamid.ABC"), false);
  assert.strictEqual((await credits.getBalance(c)).total, 0.2);

  // 5. bonus: idempotent, spent before paid credits, expires
  assert.strictEqual(await credits.grantBonus(c, { credits: 1, refId: "sub:1" }), true);
  assert.strictEqual(await credits.grantBonus(c, { credits: 1, refId: "sub:1" }), false, "same refId never pays twice");
  let b = await credits.getBalance(c);
  assert.strictEqual(b.bonus, 1);
  const r = await credits.reserve(c, { template: "t", phone: "919876543210" });
  assert.strictEqual((await CreditLedger.findById(r.ledgerId)).bucket, "bonus", "bonus is spent first");
  await CreditWallet.updateOne({ company: c }, { $set: { bonusExpiresAt: new Date(Date.now() - 1000) } });
  b = await credits.getBalance(c);
  assert.strictEqual(b.bonus, 0, "expired bonus does not count");
  assert.strictEqual(b.total, 0.2);

  // 6. top-up: webhook and browser verify race, credited once
  const t = oid();
  await credits.enable(t);
  const order = await credits.createTopup({ _id: oid(), company: t }, "p1000");
  assert.strictEqual(order.pack.total, 1180, "Rs 1000 + 18% GST");
  const results = await Promise.all([
    credits.completeTopup({ orderId: order.orderId, paymentId: "pay_1" }),
    credits.completeTopup({ orderId: order.orderId, paymentId: "pay_1" }),
  ]);
  assert.strictEqual(results.filter(Boolean).length, 1, "exactly one caller credits the wallet");
  assert.strictEqual((await credits.getBalance(t)).total, 1000);
  assert.match((await CreditTopup.findOne({ orderId: order.orderId })).invoiceNumber, /^CR-ACAD-\d{4}$/);
  await assert.rejects(credits.createTopup({ _id: oid(), company: free }, "p1000"), /not enabled/, "unmetered company cannot top up");
  await assert.rejects(credits.createTopup({ _id: oid(), company: t }, "nope"), /Unknown/);

  // 6b. subscription bonus: 10% of the amount paid, once per paid period
  const bz = oid();
  await credits.enable(bz);
  const sub = { _id: oid(), plan: "yearly", amountPaid: 6000, renewalDate: new Date("2027-10-26") };
  await credits.onSubscriptionPaid(bz, sub);
  await credits.onSubscriptionPaid(bz, sub);
  assert.strictEqual((await credits.getBalance(bz)).bonus, 600, "10% of 6000, granted once");

  // 7. daily cap stops a runaway loop
  const d = oid();
  await credits.enable(d);
  await CreditWallet.updateOne({ company: d }, { $set: { balance: credits.toUnits(100), dailyCap: 3 } });
  const capped = await Promise.all(Array.from({ length: 6 }, () => credits.reserve(d, { template: "t", phone: "919876543210" })));
  assert.strictEqual(capped.filter((x) => x.ok).length, 3);
  assert.strictEqual(capped.find((x) => !x.ok).reason, "daily_cap");

  // 8. low-balance email: one per level, re-armed by a top-up
  const l = oid();
  await mongoose.connection.collection("companies").insertOne({ _id: l, name: "Acme", email: "admin@acme.test" });
  await credits.enable(l);
  await CreditWallet.updateOne({ company: l }, { $set: { balance: credits.toUnits(50.2) } }); // 0.2 above the 50 line
  await credits.reserve(l, { template: "t", phone: "919876543210" }); // -> exactly 50: not low yet
  await sleep(150);
  assert.strictEqual(mails.length, 0);
  await credits.reserve(l, { template: "t", phone: "919876543210" }); // 49.8 -> low
  await credits.reserve(l, { template: "t", phone: "919876543210" });
  await sleep(150);
  assert.strictEqual(mails.length, 1, "one 'low' email, not one per message");
  assert.strictEqual(mails[0].zero, false);

  // 9. end to end through whatsappService with Meta stubbed: leave messages are charged, OTPs never are
  process.env.META_WA_TOKEN = "t";
  process.env.META_WA_PHONE_ID = "p";
  const https = require("https");
  const { EventEmitter } = require("events");
  const sent = [];
  let metaStatus = 200;
  https.request = (opts, cb) => {
    const req = new EventEmitter();
    let body = "";
    req.write = (b) => (body += b);
    req.end = () => {
      const res = new EventEmitter();
      res.statusCode = metaStatus;
      if (metaStatus === 200) sent.push(JSON.parse(body));
      cb(res);
      res.emit("data", JSON.stringify(metaStatus === 200 ? { messages: [{ id: `wamid.${sent.length}` }] } : { error: "rejected" }));
      res.emit("end");
    };
    return req;
  };
  require("../models/Subscription");
  const wa = require("../services/whatsappService");
  const Setting = require("../models/Setting");
  const m = oid();
  const subId = oid();
  await mongoose.connection.collection("subscriptions").insertOne({ _id: subId, status: "active", paymentStatus: "completed", isTrial: false, renewalDate: new Date(Date.now() + 30 * 86400000), wantsWhatsapp: false });
  await mongoose.connection.collection("companies").insertOne({ _id: m, name: "Club", email: "owner@club.test", subscription: subId });
  await credits.enable(m);
  await CreditWallet.updateOne({ company: m }, { $set: { balance: credits.toUnits(10) } });
  await Setting.create({ company: m, whatsappEnabled: true });
  const leave = { firstName: "Asha", leaveType: "casual", startDate: new Date(), endDate: new Date(), days: 1 };
  const bal = async () => (await credits.getBalance(m)).total;

  await wa.sendLeaveApproved("9876543210", leave, m); // plan has no whatsapp tier, but credits make it work
  assert.strictEqual(sent.length, 1, "leave message goes out");
  assert.strictEqual(await bal(), 9.8, "and costs 0.2");

  await Setting.updateOne({ company: m }, { $set: { whatsappSendLeaveAlert: "HR" } });
  await wa.sendLeaveApproved("9876543210", leave, m); // employee copy is off
  assert.strictEqual(sent.length, 1);
  await wa.sendLeaveAppliedHR("9876543210", { empName: "Asha", empId: "E1", leaveType: "casual", startDate: new Date(), endDate: new Date(), days: 1 }, m);
  assert.strictEqual(sent.length, 2, "HR copy still goes");
  await Setting.updateOne({ company: m }, { $set: { whatsappSendLeaveAlert: "Off" } });
  await wa.sendLeaveAppliedHR("9876543210", { empName: "Asha", empId: "E1", leaveType: "casual", startDate: new Date(), endDate: new Date(), days: 1 }, m);
  assert.strictEqual(sent.length, 2, "Off sends nothing");
  await Setting.updateOne({ company: m }, { $set: { whatsappSendLeaveAlert: "Both" } });

  // student check-in goes to the parent and is charged like any other message
  await wa.sendStudentCheckIn("9876543210", { guardianName: "Mr Rao", studentName: "Ravi", locationName: "Ground", time: new Date() }, m);
  assert.strictEqual(sent.length, 3, "parent alert goes out");
  assert.strictEqual(await bal(), 9.4, "and costs 0.2");

  metaStatus = 400; // Meta rejects: the credit comes back
  const before = await bal();
  await wa.sendLeaveApproved("9876543210", leave, m);
  assert.strictEqual(await bal(), before, "rejected send is refunded");
  metaStatus = 200;

  await CreditWallet.updateOne({ company: m }, { $set: { balance: 0, bonusBalance: 0 } });
  const n = sent.length;
  await wa.sendLeaveApproved("9876543210", leave, m);
  assert.strictEqual(sent.length, n, "no credits: nothing is sent");
  assert.strictEqual((await CreditLedger.findOne({ company: m, type: "skipped" }).sort({ createdAt: -1 })).note, "low_balance");

  // fee link statuses must not claim "sent" when there were no credits
  const link = await wa.sendFeePaymentLink("9876543210", { guardianName: "Mr Rao", studentName: "Ravi", planName: "Monthly", amount: 1500, url: "https://x.test/p" }, m);
  assert.strictEqual(link.status, "failed", "no credits: the fee link is reported as failed, not sent");
  assert.match(link.error, /not enough credits/);

  // a lapsed subscription stops everything, credits or not
  await CreditWallet.updateOne({ company: m }, { $set: { balance: credits.toUnits(10) } });
  await mongoose.connection.collection("subscriptions").updateOne({ _id: subId }, { $set: { renewalDate: new Date(Date.now() - 30 * 86400000) } });
  require("../utils/subscriptionStatus").invalidateCompanyAccess(m);
  const n2 = sent.length;
  await wa.sendLeaveApproved("9876543210", leave, m);
  assert.strictEqual(sent.length, n2, "expired subscription: nothing is sent");
  assert.strictEqual((await credits.getBalance(m)).total, 10, "and nothing is charged");
  await CreditWallet.updateOne({ company: m }, { $set: { balance: 0 } });

  // OTPs: zero balance, still delivered, and the wallet/ledger are never touched
  const ledgerBefore = await CreditLedger.countDocuments({});
  await wa.sendPhoneOtp("9876543210", { otp: "123456" });
  assert.strictEqual(sent.length, n2 + 1, "OTP is sent with 0 credits, even with an expired subscription");
  assert.strictEqual(await CreditLedger.countDocuments({}), ledgerBefore, "OTP never creates a ledger row");

  console.log("credits checks passed");
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
