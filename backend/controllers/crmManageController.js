// CRM-dashboard (final-pixelate) control over NestPlay customers: company, users and subscription.
// Every handler is guarded by the shared CRM_API_SECRET header, same as crmController.
const crypto = require("crypto");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const Employee = require("../models/Employee");
const safeEqual = require("../utils/safeEqual");

const guard = (req, res) => {
  if (!safeEqual(req.headers["x-api-key"], process.env.CRM_API_SECRET)) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return false;
  }
  return true;
};
const wrap = (fn) => async (req, res) => {
  if (!guard(req, res)) return;
  try {
    await fn(req, res);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: "That email is already in use" });
    if (err.name === "CastError") return res.status(400).json({ success: false, message: "Invalid id" });
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const ROLES = User.schema.path("role").enumValues;

// GET /companies/:id — company + subscription + login users + headcount
exports.getCompany = wrap(async (req, res) => {
  const company = await Company.findById(req.params.id).select("-password").lean();
  if (!company) throw fail("Company not found", 404);
  const [subscription, users, activeEmployees] = await Promise.all([
    Subscription.findOne({ company: company._id }).lean(),
    User.find({ company: company._id }).select("name email role status phone lastLogin createdAt").sort({ createdAt: 1 }).lean(),
    Employee.countDocuments({ company: company._id, status: "active" }),
  ]);
  res.json({ success: true, company, subscription, users, activeEmployees });
});

// PATCH /companies/:id — profile fields and active/inactive/trial status
exports.updateCompany = wrap(async (req, res) => {
  const set = pick(req.body, ["name", "phone", "industry", "website", "address", "city", "state", "pincode", "gstNumber", "panNumber", "status"]);
  if (set.status && !["active", "inactive", "trial"].includes(set.status)) throw fail("Invalid status");
  const company = await Company.findByIdAndUpdate(req.params.id, { $set: set }, { new: true, runValidators: true }).select("-password");
  if (!company) throw fail("Company not found", 404);
  // Deactivating a company also blocks its users' logins until it is activated again.
  if (set.status === "inactive" || set.status === "active")
    await User.updateMany({ company: company._id }, { status: set.status === "active" ? "active" : "inactive" });
  res.json({ success: true, company });
});

// PUT /companies/:id/subscription — full control: plan, limits, dates, status, custom name/features
exports.setSubscription = wrap(async (req, res) => {
  const b = req.body || {};
  const set = pick(b, ["plan", "wantsWhatsapp", "maxStudents", "maxEmployees", "monthlyPrice", "yearlyPrice", "billingCycle", "status", "paymentStatus", "amountPaid", "notes", "isTrial", "autoRenew", "customPlanName"]);
  for (const k of ["maxStudents", "maxEmployees", "monthlyPrice", "yearlyPrice", "amountPaid"]) if (set[k] !== undefined) set[k] = Math.max(0, Number(set[k]) || 0);
  if (set.maxStudents !== undefined) set.studentCount = set.maxStudents;
  if (set.maxEmployees !== undefined) set.employeeCount = set.maxEmployees;
  for (const k of ["startDate", "renewalDate", "trialEndDate"]) {
    if (b[k]) {
      const d = new Date(b[k]);
      if (isNaN(d)) throw fail(`Invalid ${k}`);
      set[k] = d;
    }
  }
  if (b.customFeatures !== undefined)
    set.customFeatures = (Array.isArray(b.customFeatures) ? b.customFeatures : String(b.customFeatures).split("\n")).map((f) => String(f).trim()).filter(Boolean).slice(0, 40);
  const company = await Company.findById(req.params.id).select("subscription");
  if (!company) throw fail("Company not found", 404);
  let sub = company.subscription && (await Subscription.findById(company.subscription));
  if (!sub) {
    const now = new Date();
    const end = new Date(now); end.setMonth(end.getMonth() + 1);
    sub = new Subscription({ company: company._id, plan: "NestPlay", monthlyPrice: 0, yearlyPrice: 0, maxStudents: 50, startDate: now, renewalDate: end });
  }
  sub.set(set);
  await sub.save();
  if (!company.subscription) await Company.updateOne({ _id: company._id }, { subscription: sub._id });
  res.json({ success: true, subscription: sub });
});

// POST /companies/:id/users
exports.createUser = wrap(async (req, res) => {
  const b = req.body || {};
  const email = String(b.email || "").trim().toLowerCase();
  if (!String(b.name || "").trim() || !/^\S+@\S+\.\S+$/.test(email)) throw fail("Name and a valid email are required");
  const role = b.role || "hr_manager";
  if (!ROLES.includes(role)) throw fail("Invalid role");
  if (!(await Company.exists({ _id: req.params.id }))) throw fail("Company not found", 404);
  let password = String(b.password || "");
  if (password && !STRONG.test(password)) throw fail("Password needs 8+ characters with uppercase, lowercase and a number");
  if (!password) password = "Nh" + crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "x") + "7";
  const user = await User.create({ name: b.name.trim(), email, password, role, phone: b.phone || undefined, company: req.params.id });
  res.status(201).json({ success: true, user: { _id: user._id, name: user.name, email, role, status: user.status }, password });
});

// PATCH /users/:id — profile, role, status; `password` resets it (and signs the user out everywhere)
exports.updateUser = wrap(async (req, res) => {
  const b = req.body || {};
  const user = await User.findById(req.params.id);
  if (!user) throw fail("User not found", 404);
  if (b.name !== undefined) user.name = String(b.name).trim();
  if (b.email !== undefined) user.email = String(b.email).trim().toLowerCase();
  if (b.phone !== undefined) user.phone = b.phone;
  if (b.role !== undefined) { if (!ROLES.includes(b.role)) throw fail("Invalid role"); user.role = b.role; }
  if (b.status !== undefined) { if (!["active", "inactive"].includes(b.status)) throw fail("Invalid status"); user.status = b.status; }
  let password;
  if (b.password) {
    if (!STRONG.test(b.password)) throw fail("Password needs 8+ characters with uppercase, lowercase and a number");
    user.password = password = b.password;
  }
  user.loginLockUntil = undefined; user.loginFailedAttempts = 0; // an admin edit also unlocks the account
  await user.save();
  res.json({ success: true, user: { _id: user._id, name: user.name, email: user.email, role: user.role, status: user.status }, password });
});

// DELETE /users/:id — removes the login only; the employee record (payroll history) stays. The company owner can't be deleted.
exports.deleteUser = wrap(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw fail("User not found", 404);
  if (await Company.exists({ createdBy: user._id })) throw fail("This is the company owner. Deactivate the company or change its owner instead.");
  await Employee.updateMany({ user: user._id }, { status: "inactive" });
  await user.deleteOne();
  res.json({ success: true });
});
