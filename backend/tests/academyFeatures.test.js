const test = require("node:test");
const assert = require("node:assert");
const { discounted } = require("../utils/siblingDiscount");
const { applyResume } = require("../utils/subscriptionPause");

test("sibling discount rounds and never goes negative", () => {
  assert.strictEqual(discounted(1000, 10), 900);
  assert.strictEqual(discounted(999, 15), 849);
  assert.strictEqual(discounted(500, 0), 500);
  assert.strictEqual(discounted(500, 100), 0);
});

test("resuming a paused plan shifts the renewal date by the days paused", () => {
  const day = 86400000;
  const now = new Date("2026-03-31T00:00:00Z");
  const sub = {
    status: "paused",
    pausedAt: new Date(now - 10 * day),
    renewalDate: new Date("2026-04-05T00:00:00Z"),
    pauseUntil: now,
    pauseReason: "travel",
  };
  const days = applyResume(sub, now);
  assert.strictEqual(days, 10);
  assert.strictEqual(sub.status, "active");
  assert.strictEqual(sub.renewalDate.toISOString(), "2026-04-15T00:00:00.000Z");
  assert.strictEqual(sub.pausedAt, undefined);
});
