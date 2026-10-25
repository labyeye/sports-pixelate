// NestAcademy side of utils/crmAccounts.js: maps the uniform CRM account API onto Company / Subscription / User.
const crypto = require("crypto");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Student = require("../models/Student");
const { helpers: H } = require("./crmAccounts");
const terms = require("./terms");

const ROLES = User.schema.path("role").enumValues;

const meta = {
  accountLabel: "Company",
  accountStatusOptions: ["active", "trial", "inactive"],
  accountStatusHint: "inactive blocks every login of this company",
  subscriptionStatusOptions: [
    "active",
    "inactive",
    "cancelled",
    "pending_renewal",
  ],
  paymentStatusOptions: ["pending", "completed", "failed"],
  planOptions: null, // free text
  limitFields: [
    { key: "maxStudents", label: "Student limit" },
    { key: "maxEmployees", label: "Staff limit" },
  ],
  flagFields: [{ key: "wantsWhatsapp", label: "WhatsApp included" }],
  roleOptions: ROLES,
  defaultRole: "hr_executive",
  ownerRole: "super_admin",
  createLimitDefaults: { maxStudents: 100, maxEmployees: 10 },
  createExtraFields: [
    { key: "gstNumber", label: "GST number" },
    { key: "industry", label: "Industry" },
  ],
  accountExtraFields: [
    { key: "gstNumber", label: "GST" },
    { key: "industry", label: "Industry" },
  ],
};

const accountView = (c) => ({
  id: c._id,
  name: c.name,
  email: c.email,
  phone: c.phone,
  status: c.status,
  gstNumber: c.gstNumber,
  industry: c.industry,
});
const subView = (s) =>
  s && {
    plan: s.plan,
    status: s.status,
    paymentStatus: s.paymentStatus,
    startDate: s.startDate,
    validTill: s.renewalDate,
    amountPaid: s.amountPaid,
    isTrial: s.isTrial,
    customPlanName: s.customPlanName,
    customFeatures: s.customFeatures || [],
    limits: { maxStudents: s.maxStudents, maxEmployees: s.maxEmployees },
    flags: { wantsWhatsapp: !!s.wantsWhatsapp },
  };
const userView = (u, ownerId) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  phone: u.phone,
  lastLogin: u.lastLogin,
  terms: terms.userState(u), termsAcceptedAt: u.termsAcceptedAt, isOwner: String(u._id) === String(ownerId),
});

exports.meta = meta;

exports.list = async (search) => {
  const q = search
    ? {
        $or: [
          {
            name: new RegExp(
              search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "i",
            ),
          },
          {
            email: new RegExp(
              search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "i",
            ),
          },
        ],
      }
    : {};
  const companies = await Company.find(q)
    .select("-password")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  const ids = companies.map((c) => c._id);
  const [subs, stus, logins, tstat] = await Promise.all([
    Subscription.find({ company: { $in: ids } }).lean(),
    Student.aggregate([
      { $match: { company: { $in: ids }, status: "active" } },
      { $group: { _id: "$company", n: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { company: { $in: ids } } },
      { $group: { _id: "$company", last: { $max: "$lastLogin" } } },
    ]),
    terms.stats(User, "company", ids),
  ]);
  const sub = Object.fromEntries(subs.map((s) => [String(s.company), s]));
  const stu = Object.fromEntries(stus.map((e) => [String(e._id), e.n]));
  const last = Object.fromEntries(logins.map((l) => [String(l._id), l.last]));
  return companies.map((c) => {
    const s = sub[String(c._id)];
    return {
      id: c._id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      status: c.status,
      plan: s?.plan,
      validTill: s?.renewalDate,
      usage: `${stu[String(c._id)] || 0} / ${s?.maxStudents ?? "—"} students`,
      lastLogin: last[String(c._id)],
      createdAt: c.createdAt,
    terms: terms.label(tstat[String(c._id)]), termsCount: tstat[String(c._id)] ? `${tstat[String(c._id)].done}/${tstat[String(c._id)].need}` : "—"
    };
  });
};

exports.get = async (id) => {
  const c = await Company.findById(id).select("-password").lean();
  if (!c) throw H.fail("Company not found", 404);
  const [s, users, activeStudents, activeStaff] = await Promise.all([
    Subscription.findOne({ company: c._id }).lean(),
    User.find({ company: c._id })
      .select("name email role status phone lastLogin termsVersion termsAcceptedAt")
      .sort({ createdAt: 1 })
      .lean(),
    Student.countDocuments({ company: c._id, status: "active" }),
    Employee.countDocuments({ company: c._id, status: "active" }),
  ]);
  return {
    account: accountView(c),
    subscription: subView(s),
    users: users.map((u) => userView(u, c.createdBy)),
    usage: { students: activeStudents, staff: activeStaff },
  };
};

exports.create = async (b) => {
  const email = String(b.email || "")
    .trim()
    .toLowerCase();
  const name = String(b.name || "").trim();
  const adminName = String(b.adminName || "").trim();
  const phone = String(b.phone || "").trim();
  const max = Number(b.limits?.maxStudents);
  if (!name || !adminName || !phone)
    throw H.fail("Company name, admin name and phone are required");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw H.fail("A valid email is required");
  if (!Number.isInteger(max) || max < 1 || max > 100000)
    throw H.fail("Student limit must be a whole number");
  const password = H.checkPassword(String(b.password || ""));
  if ((await User.findOne({ email })) || (await Company.findOne({ email })))
    throw H.fail("An account with this email already exists");
  let user;
  try {
    user = await User.create({
      name: adminName,
      email,
      password,
      role: "super_admin",
      phone,
    });
    const company = await Company.create({
      name,
      email,
      phone,
      password: crypto.randomBytes(16).toString("hex"),
      industry: b.extra?.industry || undefined,
      gstNumber: b.extra?.gstNumber || undefined,
      status: "active",
      createdBy: user._id,
    });
    const amountPaid = Math.max(0, Number(b.amountPaid) || 0);
    const sub = await Subscription.create({
      company: company._id,
      plan: b.plan || "NestAcademy",
      studentCount: max,
      employeeCount: Math.max(0, Number(b.limits?.maxEmployees) || 0),
      wantsWhatsapp: !!b.flags?.wantsWhatsapp,
      monthlyPrice: 0,
      yearlyPrice: 0,
      maxStudents: max,
      maxEmployees: Math.max(0, Number(b.limits?.maxEmployees) || 0),
      billingCycle: "monthly",
      startDate: new Date(),
      renewalDate: H.addMonths(b.months),
      status: "active",
      paymentStatus: amountPaid > 0 ? "completed" : "pending",
      amountPaid,
      notes: "Created from CRM dashboard",
    });
    company.subscription = sub._id;
    await company.save();
    user.company = company._id;
    await user.save();
    return { id: company._id, email, password, validTill: sub.renewalDate };
  } catch (e) {
    if (user && !user.company)
      await User.deleteOne({ _id: user._id }).catch(() => {});
    throw e;
  }
};

exports.updateAccount = async (id, b) => {
  const set = H.pick({ ...b, ...(b.extra || {}) }, [
    "name",
    "phone",
    "industry",
    "gstNumber",
    "status",
  ]);
  if (set.status && !meta.accountStatusOptions.includes(set.status))
    throw H.fail("Invalid status");
  const c = await Company.findByIdAndUpdate(
    id,
    { $set: set },
    { new: true, runValidators: true },
  ).select("-password");
  if (!c) throw H.fail("Company not found", 404);
  if (set.status === "inactive" || set.status === "active")
    await User.updateMany(
      { company: c._id },
      { status: set.status === "active" ? "active" : "inactive" },
    );
  return { account: accountView(c) };
};

exports.setSubscription = async (id, b) => {
  const set = H.pick(b, [
    "plan",
    "status",
    "paymentStatus",
    "amountPaid",
    "isTrial",
    "customPlanName",
  ]);
  if (set.amountPaid !== undefined)
    set.amountPaid = Math.max(0, Number(set.amountPaid) || 0);
  if (b.limits?.maxStudents !== undefined)
    set.maxStudents = set.studentCount = Math.max(
      0,
      Number(b.limits.maxStudents) || 0,
    );
  if (b.limits?.maxEmployees !== undefined)
    set.maxEmployees = set.employeeCount = Math.max(
      0,
      Number(b.limits.maxEmployees) || 0,
    );
  if (b.flags?.wantsWhatsapp !== undefined)
    set.wantsWhatsapp = !!b.flags.wantsWhatsapp;
  if (b.startDate) set.startDate = H.toDate(b.startDate, "start date");
  if (b.validTill) set.renewalDate = H.toDate(b.validTill, "valid-till date");
  if (set.isTrial) set.trialEndDate = set.renewalDate || undefined;
  const features = H.cleanFeatures(b.customFeatures);
  if (features !== undefined) set.customFeatures = features;
  const c = await Company.findById(id).select("subscription");
  if (!c) throw H.fail("Company not found", 404);
  let sub = c.subscription && (await Subscription.findById(c.subscription));
  if (!sub)
    sub = new Subscription({
      company: c._id,
      plan: "NestAcademy",
      monthlyPrice: 0,
      yearlyPrice: 0,
      maxStudents: 50,
      maxEmployees: 0,
      startDate: new Date(),
      renewalDate: H.addMonths(1),
    });
  sub.set(set);
  await sub.save();
  if (!c.subscription)
    await Company.updateOne({ _id: c._id }, { subscription: sub._id });
  return { subscription: subView(sub.toObject()) };
};

exports.createUser = async (id, b) => {
  const email = String(b.email || "")
    .trim()
    .toLowerCase();
  if (!String(b.name || "").trim() || !/^\S+@\S+\.\S+$/.test(email))
    throw H.fail("Name and a valid email are required");
  const role = b.role || meta.defaultRole;
  if (!ROLES.includes(role)) throw H.fail("Invalid role");
  if (!(await Company.exists({ _id: id })))
    throw H.fail("Company not found", 404);
  const password = H.checkPassword(String(b.password || ""));
  const u = await User.create({
    name: b.name.trim(),
    email,
    password,
    role,
    phone: b.phone || undefined,
    company: id,
  });
  return { user: userView(u), password };
};

exports.updateUser = async (uid, b) => {
  const u = await User.findById(uid);
  if (!u) throw H.fail("User not found", 404);
  if (b.name !== undefined) u.name = String(b.name).trim();
  if (b.email !== undefined) u.email = String(b.email).trim().toLowerCase();
  if (b.phone !== undefined) u.phone = b.phone;
  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) throw H.fail("Invalid role");
    u.role = b.role;
  }
  if (b.status !== undefined) {
    if (!["active", "inactive"].includes(b.status))
      throw H.fail("Invalid status");
    u.status = b.status;
  }
  let password;
  if (b.password) u.password = password = H.checkPassword(String(b.password));
  u.loginLockUntil = undefined;
  u.loginFailedAttempts = 0; // an admin edit also unlocks the account
  await u.save();
  return { user: userView(u), password };
};

// Removes the login only; the employee record (payroll history) stays. The company owner can't be deleted.
exports.deleteUser = async (uid) => {
  const u = await User.findById(uid);
  if (!u) throw H.fail("User not found", 404);
  if (await Company.exists({ createdBy: u._id }))
    throw H.fail(
      "This is the company owner. Set the company to inactive instead.",
    );
  await Employee.updateMany({ user: u._id }, { status: "inactive" });
  await u.deleteOne();
};
