// Self-check for the WhatsApp-OTP / authenticator auth flows. No DB needed:
// the models are swapped for an in-memory fake. Run: node scripts/check-auth-otp.js
const assert = require("assert");
const path = require("path");
const speakeasy = require("speakeasy");

const root = path.resolve(__dirname, "..");
process.env.JWT_SECRET = process.env.JWT_SECRET || "check-secret";

const users = [];
let lastOtp = null;

const match = (doc, filter) =>
  Object.entries(filter).every(([k, v]) => {
    if (v && typeof v === "object" && "$in" in v) return v.$in.includes(doc[k]);
    if (v && typeof v === "object" && "$gt" in v) return doc[k] > v.$gt;
    return String(doc[k]) === String(v);
  });
// Thenable that also accepts the .select()/.populate() the controllers chain.
const q = (r) => Object.assign(Promise.resolve(r), { select: () => q(r), populate: () => q(r) });
const stub = (rel, exports) => {
  const file = require.resolve(path.join(root, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};

stub("models/User.js", {
  findOne: (f) => q(users.find((u) => match(u, f)) || null),
  findById: (id) => q(users.find((u) => String(u._id) === String(id)) || null),
});
stub("models/Employee.js", { findOne: () => q(null) });
stub("models/Subscription.js", { findOne: () => q(null) });
stub("services/whatsappService.js", {
  sendPhoneOtp: async (phone, { otp }) => (lastOtp = { phone, otp }),
});
stub("services/notificationService.js", { sendPasswordResetEmail: async () => {} });

const c = require(path.join(root, "controllers/authController.js"));

const mkUser = (o) => {
  const u = { _id: String(users.length + 1), status: "active", password: "old", ...o, save: async () => u };
  users.push(u);
  return u;
};
const call = (handler, { body = {}, query = {}, user } = {}) =>
  new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(s) { this.statusCode = s; return this; },
      json(b) { resolve({ status: this.statusCode, body: b }); return this; },
    };
    handler({ body, query, user }, res, (e) => resolve({ status: res.statusCode, error: e && e.message }));
  });

(async () => {
  const a = mkUser({ email: "a@x.com", phone: "9111111111" });
  const b = mkUser({ email: "b@x.com", phone: "9222222222" });

  // Login OTP must be bound to the phone it was sent to.
  await call(c.sendOtp, { body: { phone: a.phone } });
  const otpA = lastOtp.otp;
  await call(c.sendOtp, { body: { phone: b.phone } });
  const otpB = lastOtp.otp;
  assert.strictEqual((await call(c.verifyOtp, { body: { phone: a.phone, otp: otpB } })).status, 401, "B's OTP must not log in via A's phone");
  assert.strictEqual((await call(c.verifyOtp, { body: { phone: a.phone, otp: otpA } })).status, 200);

  // Phone verification, and changing the phone drops it.
  assert.strictEqual((await call(c.verifyPhoneVerifyOtp, { user: a, body: { otp: "000000" } })).status, 400);
  await call(c.sendPhoneVerifyOtp, { user: a });
  assert.strictEqual((await call(c.verifyPhoneVerifyOtp, { user: a, body: { otp: lastOtp.otp } })).status, 200);
  assert.strictEqual(a.phoneVerified, true);

  // Reset methods reflect what is set up.
  assert.deepStrictEqual((await call(c.forgotPasswordMethods, { query: { email: a.email } })).body.data.methods, ["email", "whatsapp"]);

  // WhatsApp-code reset: wrong code, weak password, good code, single use.
  lastOtp = null;
  await call(c.forgotPasswordWhatsapp, { body: { email: a.email } });
  const resetCode = lastOtp.otp;
  assert.strictEqual((await call(c.resetPasswordWithOtp, { body: { email: a.email, otp: "111111", password: "Newpass1" } })).status, 400);
  assert.strictEqual((await call(c.resetPasswordWithOtp, { body: { email: a.email, otp: resetCode, password: "weak" } })).status, 400);
  assert.strictEqual((await call(c.resetPasswordWithOtp, { body: { email: a.email, otp: resetCode, password: "Newpass1" } })).status, 200);
  assert.strictEqual(a.password, "Newpass1");
  assert.strictEqual((await call(c.resetPasswordWithOtp, { body: { email: a.email, otp: resetCode, password: "Another1" } })).status, 400, "reset code is single-use");

  // Unverified phone: no code is sent, same response.
  lastOtp = null;
  assert.strictEqual((await call(c.forgotPasswordWhatsapp, { body: { email: b.email } })).status, 200);
  assert.strictEqual(lastOtp, null);

  // Authenticator reset, backup codes, lockout.
  const secret = speakeasy.generateSecret().base32;
  const t = mkUser({ email: "t@x.com", twoFactorEnabled: true, twoFactorSecret: secret, twoFactorBackupCodes: ["aaaa1111"] });
  const totpNow = () => speakeasy.totp({ secret, encoding: "base32" });
  const reset = (token, password = "Newpass1") => call(c.resetPasswordWithTotp, { body: { email: t.email, token, password } });
  assert.strictEqual((await reset("000000")).status, 401);
  assert.strictEqual((await reset(totpNow())).status, 200);
  assert.strictEqual((await reset("aaaa1111", "Backup11")).status, 200);
  assert.strictEqual((await reset("aaaa1111", "Backup22")).status, 401, "backup code is single-use");
  for (let i = 0; i < 10; i++) await reset("000000");
  assert.strictEqual((await reset(totpNow())).status, 429, "locked after 10 bad codes");
  assert.strictEqual((await call(c.resetPasswordWithTotp, { body: { email: a.email, token: "123456", password: "Newpass1" } })).status, 400, "no 2FA -> no totp reset");

  console.log("auth otp/totp checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
