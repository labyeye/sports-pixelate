const { logAudit } = require("../utils/auditLogger");

// Records every successful write (POST/PUT/PATCH/DELETE) under the mounted
// prefixes in the audit log, so changes to students, fees, payroll, settings
// and the like are traceable without touching each controller. Request bodies
// are never stored — only who, what, where and when.
const NOUNS = {
  "/api/students": ["Student", "student"],
  "/api/parents": ["User", "parent"],
  "/api/student-attendance": ["StudentAttendance", "student_attendance"],
  "/api/subscriptions": ["StudentSubscription", "subscription"],
  "/api/payment-links": ["PaymentLink", "payment_link"],
  "/api/plans": ["SportsPlan", "plan"],
  "/api/payroll": ["Payroll", "payroll"],
  "/api/payroll-config": ["PayrollConfig", "payroll_config"],
  "/api/salary-heads": ["SalaryHead", "salary_head"],
  "/api/loans": ["Loan", "loan"],
  "/api/expenses": ["Expense", "expense"],
  "/api/settings": ["Setting", "settings"],
  "/api/attendance-settings": ["DeductionRule", "attendance_settings"],
  "/api/payment-methods": ["PaymentMethod", "payment_method"],
  "/api/documents": ["EmployeeDocument", "document"],
  "/api/admin": ["Admin", "admin"],
};

const VERBS = { POST: "created", PUT: "updated", PATCH: "updated", DELETE: "deleted" };
const ID_RE = /^[a-f0-9]{24}$/i;

function describe(req) {
  const full = req.originalUrl.split("?")[0] || "";
  const prefix = Object.keys(NOUNS).find(
    (p) => full === p || full.startsWith(p + "/"),
  );
  if (!prefix) return null;
  const [entity, noun] = NOUNS[prefix];
  const path = full.slice(prefix.length);
  const parts = path.split("/").filter(Boolean);
  const entityId = parts.find((p) => ID_RE.test(p));
  // A named sub-action ("/:id/verify", "/process") reads better than "updated".
  const named = parts
    .filter((p) => !ID_RE.test(p))
    .pop()
    ?.replace(/[^a-z0-9]+/gi, "_")
    .toLowerCase();
  const verb = named ? named : VERBS[req.method];
  return { entity, entityId, action: `${noun}_${verb}` };
}

module.exports = function auditWrites(req, res, next) {
  if (!VERBS[req.method]) return next();
  res.on("finish", () => {
    if (res.statusCode >= 400 || !req.user) return;
    const d = describe(req);
    if (!d) return;
    logAudit(req, d.action, d.entity, d.entityId, {
      method: req.method,
      path: req.originalUrl.split("?")[0],
    });
  });
  next();
};
