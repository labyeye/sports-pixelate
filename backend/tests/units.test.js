process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const test = require("node:test");
const assert = require("node:assert");

const days = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

test("calculatePricing: ₹30/user, ₹50 with WhatsApp, +18% GST", () => {
  const { calculatePricing } = require("../utils/pricing");
  const base = calculatePricing(100, 5, false);
  assert.strictEqual(base.ratePerUnit, 30);
  assert.strictEqual(base.monthlySubtotal, 3150);
  assert.strictEqual(base.monthlyGstAmount, 567);
  assert.strictEqual(base.monthlyPrice, 3717);
  assert.strictEqual(base.yearlyPrice, 44604);
  const wa = calculatePricing(100, 5, true);
  assert.strictEqual(wa.ratePerUnit, 50);
  assert.strictEqual(wa.monthlySubtotal, 5250);
});

test("subscription is live only when paid, current and not past grace", () => {
  const { evaluate } = require("../utils/subscriptionStatus");
  const ok = { status: "active", paymentStatus: "completed", renewalDate: days(10) };
  assert.strictEqual(evaluate(ok).live, true);
  assert.strictEqual(evaluate({ ...ok, renewalDate: days(-3) }).live, true, "inside 7-day grace");
  assert.strictEqual(evaluate({ ...ok, renewalDate: days(-9) }).live, false, "past grace");
  assert.strictEqual(evaluate({ ...ok, status: "cancelled" }).live, false);
  assert.strictEqual(evaluate({ ...ok, paymentStatus: "pending" }).live, false);
  assert.strictEqual(evaluate(null).live, false);
  assert.strictEqual(
    evaluate({ ...ok, isTrial: true, trialEndDate: days(-1) }).reason,
    "trial_expired",
  );
});

test("WhatsApp is only enabled when the academy bought it", () => {
  const { evaluate } = require("../utils/subscriptionStatus");
  const base = { status: "active", paymentStatus: "completed", renewalDate: days(30) };
  assert.strictEqual(evaluate(base).whatsapp, false);
  assert.strictEqual(evaluate({ ...base, wantsWhatsapp: true }).whatsapp, true);
  assert.strictEqual(
    evaluate({ ...base, wantsWhatsapp: true, status: "inactive" }).whatsapp,
    false,
    "lapsed plan never sends WhatsApp",
  );
});

test("stripProtected removes tenant/id fields (and extras)", () => {
  const { stripProtected } = require("../middleware/validate");
  const out = stripProtected(
    { _id: "1", company: "other", name: "x", employee: "e", createdAt: "d" },
    ["employee"],
  );
  assert.deepStrictEqual(out, { name: "x" });
  assert.deepStrictEqual(stripProtected(undefined), {});
});

test("fee reminder stages", () => {
  const { currentStage } = require("../jobs/subscriptionLifecycle");
  assert.strictEqual(currentStage(-10), null);
  assert.strictEqual(currentStage(-7), -7);
  assert.strictEqual(currentStage(-2), -3);
  assert.strictEqual(currentStage(0), 0);
  assert.strictEqual(currentStage(5), 3);
  assert.strictEqual(currentStage(40), 30);
});

test("private upload folders are closed, proofs need a token", async () => {
  const { uploadGuard } = require("../middleware/uploadGuard");
  const run = (path, extra = {}) =>
    new Promise((resolve) => {
      const res = {
        status(c) { this.code = c; return this; },
        json() { resolve(this.code); },
        sendStatus(c) { resolve(c); },
      };
      uploadGuard({ path, headers: {}, query: {}, ...extra }, res, () => resolve("next"));
    });
  assert.strictEqual(await run("/employee-aadhaar/x.pdf"), 403);
  assert.strictEqual(await run("/employee-docs/x.pdf"), 403);
  assert.strictEqual(await run("/payment-screenshots/c1_x.jpg"), 401, "no token");
  assert.strictEqual(await run("/avatars/a.jpg"), "next", "public media stays public");
});

test("computeEmployeePayroll: hours earned, absent credit/deduction, loan EMI", () => {
  const { computeEmployeePayroll, IST_OFFSET_MS } = require("../utils/payrollCalc");
  // Jan 2026, Mon-Sat week = 27 working days -> daily rate 1000, 9h shift.
  const ist = (d, h) => new Date(Date.UTC(2026, 0, d, h) - IST_OFFSET_MS);
  const day = (d, extra) => ({ date: ist(d, 0), status: "present", ...extra });
  const attendances = [
    day(5, { checkIn: ist(5, 9), checkOut: ist(5, 18) }),
    day(6, { checkIn: ist(6, 9), checkOut: ist(6, 18) }),
    day(7, { status: "absent" }),
  ];
  const { record, loanUpdates } = computeEmployeePayroll({
    emp: { salary: 27000, workDaysPerWeek: 6, shift: { startTime: "09:00", endTime: "18:00" } },
    attendances,
    year: 2026,
    month: 1,
    deductionRule: null,
    pendingTx: [],
    activeLoans: [{ _id: "L1", remainingBalance: 5000, monthlyEmi: 500 }],
  });
  assert.strictEqual(record.workingDays, 27);
  assert.strictEqual(record.totalWorkHours, 18);
  assert.strictEqual(record.earnedBasic, 3000); // 2 days of hours + the absent-day credit
  assert.strictEqual(record.absentDeduction, 1000);
  assert.strictEqual(record.loanDeduction, 500);
  assert.strictEqual(record.netSalary, 1500);
  assert.deepStrictEqual(loanUpdates, [{ id: "L1", newBalance: 4500, cleared: false }]);
});

test("errorHandler turns database validation errors into plain messages", () => {
  const mongoose = require("mongoose");
  const errorHandler = require("../middleware/errorHandler");
  const send = (err, code = 200) => {
    let out;
    const res = {
      statusCode: code,
      status(c) { this.statusCode = c; return this; },
      json(b) { out = { status: this.statusCode, message: b.message }; },
    };
    errorHandler(err, { method: "POST", originalUrl: "/x" }, res, () => {});
    return out;
  };
  const Model = mongoose.model(
    "ErrorHandlerProbe",
    new mongoose.Schema({ firstName: { type: String, required: true }, age: { type: Number, min: 5 } }),
  );
  assert.deepStrictEqual(send(new Model({ age: 1 }).validateSync()), {
    status: 400,
    message: "First name is required. Age is too small",
  });
  assert.deepStrictEqual(
    send(Object.assign(new Error("dup"), { code: 11000, keyValue: { phone: "1" } })),
    { status: 400, message: "Phone already exists. Please use a different one" },
  );
  assert.strictEqual(send(Object.assign(new Error("x"), { name: "MulterError", code: "LIMIT_FILE_SIZE" })).status, 413);
});

test("uploads are encrypted at rest, tamper-proof, and legacy plaintext still reads", async () => {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const crypto = require("crypto");
  process.env.UPLOAD_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
  const fc = require("../utils/fileCrypto");
  const { validateMagicBytes } = require("../middleware/upload");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "enc-"));
  // 1x1 PNG
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  const file = path.join(dir, "photo.png");
  fs.writeFileSync(file, png);

  assert.strictEqual(fc.encryptFileInPlace(file), true);
  const onDisk = fs.readFileSync(file);
  assert.ok(fc.isEncryptedBuffer(onDisk), "file on disk carries the encryption header");
  assert.ok(!onDisk.includes(png), "plaintext bytes are not present on disk");
  assert.strictEqual(fc.encryptFileInPlace(file), false, "second run is a no-op");
  assert.ok(fc.readDecrypted(file).equals(png), "decrypts back to the original");
  await validateMagicBytes(file); // type check still works on an encrypted file

  const tampered = Buffer.from(onDisk);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => fc.decryptBuffer(tampered), "tampering is detected");

  const legacy = path.join(dir, "old.png");
  fs.writeFileSync(legacy, png);
  assert.ok(fc.readDecrypted(legacy).equals(png), "legacy plaintext passes through");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("removeStoredUpload deletes the old file, but only inside the uploads folder and never the new one", () => {
  const fs = require("fs");
  const path = require("path");
  const { UPLOAD_DIR } = require("../config/paths");
  const { removeStoredUpload } = require("../utils/uploadFiles");
  const dir = path.join(UPLOAD_DIR, "avatars");
  fs.mkdirSync(dir, { recursive: true });
  const oldFile = path.join(dir, "test_old_avatar.jpg");
  const newFile = path.join(dir, "test_new_avatar.jpg");
  fs.writeFileSync(oldFile, "old");
  fs.writeFileSync(newFile, "new");

  removeStoredUpload("http://localhost:5000/uploads/avatars/test_old_avatar.jpg", newFile);
  assert.ok(!fs.existsSync(oldFile), "old photo removed (URL form)");
  assert.ok(fs.existsSync(newFile), "new photo untouched");

  removeStoredUpload("/uploads/avatars/test_new_avatar.jpg", newFile);
  assert.ok(fs.existsSync(newFile), "same path as the new file is kept");

  const outside = path.join(UPLOAD_DIR, "..", "package.json");
  removeStoredUpload("/uploads/../package.json");
  assert.ok(fs.existsSync(outside), "paths outside the uploads folder are never deleted");
  removeStoredUpload(undefined);
  removeStoredUpload("not-an-upload");

  fs.rmSync(newFile, { force: true });
});
