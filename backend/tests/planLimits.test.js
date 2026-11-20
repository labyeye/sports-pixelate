process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const test = require("node:test");
const assert = require("node:assert");

const Subscription = require("../models/Subscription");
const Student = require("../models/Student");
const { assertStudentSlot } = require("../utils/studentLimit");

const stub = (max, active) => {
  Subscription.findOne = () => ({ select: async () => (max === null ? null : { maxStudents: max }) });
  Student.countDocuments = async () => active;
};
const res = () => ({ code: 0, status(c) { this.code = c; return this; } });

test("plan limit: a full Starter plan refuses the 51st student with a 403", async () => {
  stub(50, 50);
  const r = res();
  await assert.rejects(() => assertStudentSlot("c1", r), /Student limit reached \(50\/50\)/);
  assert.strictEqual(r.code, 403);
});

test("plan limit: room left, unlimited and legacy (no limit) all pass", async () => {
  stub(50, 49);
  await assertStudentSlot("c1", res());
  stub(1000000, 5000);
  await assertStudentSlot("c1", res());
  stub(null, 999);
  await assertStudentSlot("c1", res());
  stub(100, 98);
  await assert.rejects(() => assertStudentSlot("c1", res(), 5), /limit reached/);
});

test("gateway: parents' money never falls back to the platform account", async () => {
  const gw = require("../services/paymentGatewayService");
  await assert.rejects(() => gw.createOrder("cashfree", undefined, { amount: 1, orderId: "x", customer: { id: "1" }, returnUrl: "https://x" }), /not connected/);
  await assert.rejects(() => gw.createOrder("razorpay", { keyId: "a", keySecret: "b" }, { amount: 1 }), /Unsupported/);
});

test("student ID card design keeps student fields and still refuses unknown ones", () => {
  const { sanitizeIdCardTemplate } = require("../utils/idCardTemplate");
  const t = sanitizeIdCardTemplate({
    front: {
      elements: [
        { kind: "field", field: "studentId" },
        { kind: "field", field: "guardianPhone" },
        { kind: "field", field: "password" },
        { kind: "qr", qrField: "studentId" },
      ],
    },
  });
  assert.deepStrictEqual(
    t.front.elements.map((e) => e.field),
    ["studentId", "guardianPhone", "fullName", "fullName"],
  );
  assert.strictEqual(t.front.elements[3].qrField, "studentId");
});
