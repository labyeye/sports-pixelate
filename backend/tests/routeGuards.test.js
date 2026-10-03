process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const test = require("node:test");
const assert = require("node:assert");
const { buildRouteTable } = require("./helpers/routeTable");

const table = buildRouteTable();
const OWNER = ["super_admin", "hr_manager"];

const find = (file, method, path) =>
  table.find((r) => r.file === file && r.method === method && r.path === path);

const isOwnerOnly = (r) =>
  r && r.roles && r.roles.every((role) => OWNER.includes(role));

test("every route file loads", () => {
  const broken = table.filter((r) => r.error);
  assert.deepStrictEqual(broken, []);
});

// Write endpoints that any logged-in user may call BY DESIGN (the handler
// scopes to the caller's own data, or the route authenticates another way —
// device token, company token, shared secret, webhook signature). A new
// unguarded write route fails this test: either add authorize(...) or add it
// here with a reason.
const ANY_LOGGED_IN_WRITES = new Set([
  // public / own-credential flows
  "auth POST /register", "auth POST /login", "auth PUT /profile",
  "auth POST /forgot-password", "auth POST /reset-password/:token",
  "auth POST /forgot-password/whatsapp", "auth POST /reset-password/otp/whatsapp",
  "auth POST /reset-password/otp/totp", "auth POST /phone/send-otp",
  "auth POST /phone/verify-otp", "auth POST /otp/send", "auth POST /otp/verify",
  "auth POST /2fa/setup", "auth POST /2fa/confirm", "auth POST /2fa/disable",
  "auth POST /2fa/verify",
  // other auth schemes
  "admin POST /offer-codes", "admin PATCH /offer-codes/:id", // platform-admin JWT
  "crm POST /companies", "crm PATCH /companies/:companyId/subscription",
  "crm POST /offers", "crm PATCH /offers/:id", "crm DELETE /offers/:id", // CRM secret
  "adms POST /cdata,/cdata.aspx", "adms POST /devicecmd,/devicecmd.aspx", // device serial
  "biometric POST /register", "biometric POST /record",
  "biometric POST /device-face-enroll", "biometric POST /face-attendance", // device token
  "whatsappWebhook POST /", // HMAC signature
  // self-service: handler scopes to the caller / their children
  "attendance POST /self-mark", "attendanceCorrection POST /", "leave POST /",
  "loan POST /request", "employee POST /me/face-enroll", "employee DELETE /me/face",
  "notification POST /:id/read", "notification POST /read-all",
  "push POST /subscribe", "push DELETE /unsubscribe", "push POST /fcm-register",
  "support POST /", "support POST /:id/reply", "support POST /:id/close",
  "support PATCH /:id/status",
  "booking POST /", "booking POST /verify-payment", "booking POST /:id/cancel",
  "event POST /:id/registrations", "event DELETE /:id/registrations/:studentId",
  "subscription POST /create-order", "subscription POST /verify-payment",
  "subscription POST /qr-renewal", "subscription POST /:id/payments",
]);

test("no new unguarded write endpoints", () => {
  const unexpected = table
    .filter((r) => r.write && !r.roles)
    .map((r) => `${r.file} ${r.method.toUpperCase()} ${[].concat(r.path).join(",")}`)
    .filter((k) => !ANY_LOGGED_IN_WRITES.has(k));
  assert.deepStrictEqual(
    unexpected,
    [],
    "These write routes have no authorize(...) guard:\n" + unexpected.join("\n"),
  );
});

test("resetting someone else's face is owner-only", () => {
  assert.ok(
    isOwnerOnly(find("biometric", "delete", "/people/:personType/:id/face")),
    "biometric face reset must be owner-only",
  );
});

test("loan approval/creation/deletion are owner-only (employees can only request)", () => {
  for (const [m, p] of [
    ["post", "/"], ["post", "/bulk-import"], ["put", "/:id/status"],
    ["put", "/:id"], ["delete", "/:id"],
  ]) {
    assert.ok(isOwnerOnly(find("loan", m, p)), `loan ${m} ${p} must be owner-only`);
  }
  assert.ok(!find("loan", "post", "/request").roles, "loan request stays open to staff");
});

test("shifts, designations, salary heads, transactions, payment methods: writes are owner-only", () => {
  for (const file of ["shift", "designation", "salaryHead", "transaction", "paymentMethod"]) {
    const writes = table.filter((r) => r.file === file && r.write);
    assert.ok(writes.length > 0, `${file} has write routes`);
    for (const r of writes) assert.ok(isOwnerOnly(r), `${file} ${r.method} ${r.path} must be owner-only`);
  }
});

test("billing and company-wide dashboard stats are not open to employees/parents", () => {
  for (const r of table.filter((x) => x.file === "billing" && x.path !== "/plans")) {
    assert.ok(isOwnerOnly(r), `billing ${r.method} ${r.path} must be owner-only`);
  }
  const stats = find("dashboard", "get", "/stats");
  assert.ok(stats.roles && !stats.roles.includes("employee") && !stats.roles.includes("parent"));
});

test("aggregate student reports are owner-only", () => {
  for (const p of ["/student-fees", "/student-outstanding", "/student-performance",
    "/student-enrollment", "/batch-summary", "/sport-summary"]) {
    assert.ok(isOwnerOnly(find("reports", "get", p)), `reports ${p} must be owner-only`);
  }
});

test("exit management is owner-only", () => {
  const rows = table.filter((r) => r.file === "exit");
  assert.ok(rows.length >= 6);
  for (const r of rows) assert.ok(isOwnerOnly(r), `exit ${r.method} ${r.path}`);
});

test("parents are denied employee data and staff-only payment actions", () => {
  const denied = [
    ["employee", "GET", "/"], ["employee", "GET", "/:id"],
    ["document", "GET", "/"], ["document", "GET", "/:id/download"],
    ["leave", "GET", "/"], ["attendance", "GET", "/"], ["attendance", "GET", "/summary"],
    ["attendanceCorrection", "GET", "/"],
    ["subscription", "POST", "/:id/payments/:paymentId/verify"],
    ["subscription", "POST", "/:id/payments/:paymentId/reject"],
  ];
  for (const [file, method, path] of denied) {
    const r = find(file, method.toLowerCase(), path);
    assert.ok(r && r.roles, `${file} ${method} ${path} must use authorize()`);
    assert.ok(!r.roles.includes("parent"), `${file} ${method} ${path} allows parent`);
  }
  const verify = find("subscription", "post", "/:id/payments/:paymentId/verify");
  assert.ok(isOwnerOnly(verify));
  assert.ok(!find("subscription", "post", "/:id/payments/:paymentId/reject").roles.includes("employee"));
  assert.deepStrictEqual(table.filter((r) => r.file === "company").map((r) => `${r.method} ${r.path}`), ["get /me"]);
});
