const { notifyUsers } = require("../services/inAppNotify");
const { UPLOAD_DIR } = require("../config/paths");
const path = require("path");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const asyncHandler = require("express-async-handler");
const Expense = require("../models/ExpenseClaim");
const ApprovalWorkflow = require("../models/ApprovalWorkflow");
const Employee = require("../models/Employee");
const Transaction = require("../models/Transaction");
const ExpensePolicy = require("../models/ExpensePolicy");
const { validateMagicBytes } = require("../middleware/upload");

const BILL_DIR = path.join(UPLOAD_DIR, "expense-bills");
const ROLES = ["department_head", "hr_manager", "super_admin"];
const CATEGORIES = ["travel", "food", "fuel", "lodging", "internet_phone", "office", "other"];
const PAY_MODES = ["bank_transfer", "upi", "cash", "cheque"];

const billsOf = (e) => [...(e.bills || []), ...(e.bill ? [e.bill] : [])];
const dropFiles = (files) => (files || []).forEach((f) => fs.unlink(f.path, () => {}));

async function getPolicy(company) {
  const p = await ExpensePolicy.findOne({ company }).lean();
  return {
    limits: p?.limits ? Object.fromEntries(Object.entries(p.limits)) : {},
    billRequiredAbove: p?.billRequiredAbove || 0,
  };
}

// Parse + validate the claim fields shared by create / edit. Throws on invalid input.
function parseClaim(body) {
  const amount = Number(body.amount);
  const date = new Date(body.date);
  const title = (body.title || "").trim();
  const category = CATEGORIES.includes(body.category) ? body.category : "other";
  if (!title || !(amount > 0) || isNaN(date) || date > new Date())
    throw new Error("Title, a valid amount and a past date are required");
  const num = (v) => (v === undefined || v === "" || isNaN(Number(v)) ? undefined : Math.max(0, Number(v)));
  const dt = (v) => (v && !isNaN(new Date(v)) ? new Date(v) : undefined);
  const str = (v) => String(v || "").trim().slice(0, 100);
  const d = {};
  if (category === "travel") Object.assign(d, { from: str(body.from), to: str(body.to), distanceKm: num(body.distanceKm) });
  if (category === "fuel") Object.assign(d, { distanceKm: num(body.distanceKm), fuelLitres: num(body.fuelLitres), vendor: str(body.vendor) });
  if (category === "lodging") {
    Object.assign(d, { checkIn: dt(body.checkIn), checkOut: dt(body.checkOut), vendor: str(body.vendor) });
    if (d.checkIn && d.checkOut && d.checkOut < d.checkIn) throw new Error("Check-out cannot be before check-in");
  }
  if (["food", "internet_phone", "office", "other"].includes(category)) d.vendor = str(body.vendor);
  return { title: title.slice(0, 120), category, amount, date, notes: (body.notes || "").slice(0, 500), details: d };
}

async function selfEmployee(req) {
  return Employee.findOne({ user: req.user._id, company: req.user.company });
}

async function stepsFor(company, amount) {
  const wf = await ApprovalWorkflow.findOne({ company, type: "expense" }).lean();
  const steps = (wf?.steps?.length ? wf.steps : [{ role: "hr_manager" }])
    .filter((s) => amount >= (s.aboveAmount || 0))
    .map((s) => ({ role: s.role }));
  return steps.length ? steps : [{ role: "hr_manager" }];
}

// Can this user act on the claim's current step?
function canAct(user, expense, empDept) {
  if (expense.status !== "pending") return false;
  const step = expense.steps.find((s) => s.status === "pending");
  if (!step) return false;
  if (user.role === "super_admin") return true;
  if (user.role !== step.role) return false;
  if (step.role === "department_head")
    return !!user.department && String(user.department) === String(empDept);
  return true;
}

// Approved claims become a pending "allowance" transaction, which payroll already adds to gross.
// Once payroll has applied the transaction the claim shows as paid.
async function syncPaid(company) {
  const approved = await Expense.find({
    company,
    status: "approved",
    transaction: { $ne: null },
  })
    .select("transaction")
    .lean();
  if (!approved.length) return;
  const applied = await Transaction.find({
    _id: { $in: approved.map((e) => e.transaction) },
    status: "applied",
  })
    .select("_id")
    .lean();
  if (applied.length)
    await Expense.updateMany(
      { transaction: { $in: applied.map((t) => t._id) }, status: "approved" },
      { status: "paid", "payment.mode": "payroll", "payment.paidOn": new Date() },
    );
}

const getExpenses = asyncHandler(async (req, res) => {
  await syncPaid(req.user.company);
  const filter = { company: req.user.company };
  if (req.user.role === "employee") {
    const emp = await selfEmployee(req);
    if (!emp) {
      res.status(404);
      throw new Error("Employee record not found for your account");
    }
    filter.employee = emp._id;
  } else filter.status = { $ne: "draft" }; // drafts are private to their owner
  if (req.query.status) filter.status = String(req.query.status);
  let rows = await Expense.find(filter)
    .sort({ createdAt: -1 })
    .limit(500)
    .populate("employee", "firstName lastName employeeId department")
    .lean();
  if (req.user.role === "department_head")
    rows = rows.filter(
      (r) => String(r.employee?.department) === String(req.user.department),
    );
  res.json({
    success: true,
    data: rows.map((r) => ({
      ...r,
      billCount: billsOf(r).length,
      hasBill: billsOf(r).length > 0,
      bill: undefined,
      bills: undefined,
      canAct: canAct(req.user, r, r.employee?.department),
    })),
  });
});

// Applies policy to a claim that is being submitted; returns the fields to store.
async function submitFields(company, fields, billCount) {
  const policy = await getPolicy(company);
  if (policy.billRequiredAbove && fields.amount > policy.billRequiredAbove && !billCount)
    throw new Error(`A bill is required for claims above ₹${policy.billRequiredAbove}`);
  const limit = policy.limits[fields.category] || 0;
  return {
    status: "pending",
    policyExceeded: !!limit && fields.amount > limit,
    steps: await stepsFor(company, fields.amount),
  };
}

const createExpense = asyncHandler(async (req, res) => {
  const emp = await selfEmployee(req);
  try {
    if (!emp) {
      res.status(404);
      throw new Error("Employee record not found for your account");
    }
    const files = req.files || [];
    for (const f of files) await validateMagicBytes(f.path); // throws + deletes file if invalid
    let fields;
    try {
      fields = parseClaim(req.body);
    } catch (e) {
      res.status(400);
      throw e;
    }
    const isDraft = req.body.draft === "true";
    const extra = isDraft
      ? { status: "draft", steps: [] }
      : await submitFields(req.user.company, fields, files.length).catch((e) => {
          res.status(400);
          throw e;
        });
    const expense = await Expense.create({
      company: req.user.company,
      employee: emp._id,
      ...fields,
      ...extra,
      bills: files.map((f) => f.filename),
    });
    res.status(201).json({ success: true, data: expense });
  } catch (e) {
    dropFiles(req.files);
    throw e;
  }
});

// Edit a draft (optionally submitting it). Keeps existing bills unless removeBills lists some; new files are added.
const updateExpense = asyncHandler(async (req, res) => {
  try {
    const emp = await selfEmployee(req);
    const expense = await Expense.findOne({ _id: req.params.id, company: req.user.company });
    if (!expense || !emp || String(expense.employee) !== String(emp._id)) {
      res.status(404);
      throw new Error("Claim not found");
    }
    if (expense.status !== "draft") {
      res.status(400);
      throw new Error("Only drafts can be edited");
    }
    const files = req.files || [];
    for (const f of files) await validateMagicBytes(f.path);
    let fields;
    try {
      fields = parseClaim(req.body);
    } catch (e) {
      res.status(400);
      throw e;
    }
    let remove = req.body.removeBills || [];
    if (!Array.isArray(remove)) remove = String(remove).split(",").filter(Boolean);
    const removed = expense.bills.filter((b) => remove.includes(b));
    const kept = expense.bills.filter((b) => !remove.includes(b));
    if (kept.length + files.length > 5) {
      res.status(400);
      throw new Error("A claim can have at most 5 bills");
    }
    const extra =
      req.body.draft === "true"
        ? {}
        : await submitFields(req.user.company, fields, kept.length + files.length + (expense.bill ? 1 : 0)).catch((e) => {
            res.status(400);
            throw e;
          });
    expense.set({ ...fields, ...extra, bills: [...kept, ...files.map((f) => f.filename)] });
    await expense.save();
    removed.forEach((b) => fs.unlink(path.join(BILL_DIR, path.basename(b)), () => {}));
    res.json({ success: true, data: expense });
  } catch (e) {
    dropFiles(req.files);
    throw e;
  }
});

// Rejected claim -> new pending claim (bills are shared by copying the file names' files).
const resubmitExpense = asyncHandler(async (req, res) => {
  const emp = await selfEmployee(req);
  const old = await Expense.findOne({ _id: req.params.id, company: req.user.company });
  if (!old || !emp || String(old.employee) !== String(emp._id)) {
    res.status(404);
    throw new Error("Claim not found");
  }
  if (old.status !== "rejected") {
    res.status(400);
    throw new Error("Only rejected claims can be resubmitted");
  }
  if (await Expense.exists({ resubmissionOf: old._id })) {
    res.status(400);
    throw new Error("This claim was already resubmitted");
  }
  const copies = [];
  for (const b of billsOf(old)) {
    const src = path.join(BILL_DIR, path.basename(b));
    const name = `${Date.now()}_${require("crypto").randomUUID()}${path.extname(b)}`;
    try {
      fs.copyFileSync(src, path.join(BILL_DIR, name));
      copies.push(name);
    } catch (_) {}
  }
  let fields;
  try {
    fields = parseClaim({ ...old.toObject(), ...req.body, ...(old.details || {}), date: req.body.date || old.date });
    const extra = await submitFields(req.user.company, fields, copies.length);
    const expense = await Expense.create({
      company: old.company,
      employee: old.employee,
      ...fields,
      ...extra,
      bills: copies,
      resubmissionOf: old._id,
    });
    res.status(201).json({ success: true, data: expense });
  } catch (e) {
    copies.forEach((n) => fs.unlink(path.join(BILL_DIR, n), () => {}));
    if (res.statusCode < 400) res.status(400);
    throw e;
  }
});

const actOnExpense = asyncHandler(async (req, res) => {
  const { action, note } = req.body;
  if (!["approve", "reject"].includes(action)) {
    res.status(400);
    throw new Error("action must be approve or reject");
  }
  const expense = await Expense.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!expense) {
    res.status(404);
    throw new Error("Claim not found");
  }
  const emp = await Employee.findById(expense.employee).select("department user");
  if (emp && String(emp.user) === String(req.user._id)) {
    res.status(403);
    throw new Error("You cannot approve your own claim");
  }
  if (!canAct(req.user, expense, emp?.department)) {
    res.status(403);
    throw new Error("This claim is not waiting for your approval");
  }
  let approvedAmount = expense.approvedAmount ?? expense.amount;
  if (action === "approve" && req.body.approvedAmount !== undefined && req.body.approvedAmount !== "") {
    approvedAmount = Number(req.body.approvedAmount);
    if (!(approvedAmount > 0) || approvedAmount > expense.amount) {
      res.status(400);
      throw new Error("Approved amount must be above 0 and not more than the claimed amount");
    }
    if (approvedAmount < expense.amount && !(note || "").trim()) {
      res.status(400);
      throw new Error("Add a note explaining the reduced amount");
    }
    expense.approvedAmount = approvedAmount;
  }
  const step = expense.steps.find((s) => s.status === "pending");
  step.status = action === "approve" ? "approved" : "rejected";
  step.by = req.user._id;
  step.at = new Date();
  step.note = (note || "").slice(0, 300);
  if (action === "reject") expense.status = "rejected";
  else if (expense.steps.every((s) => s.status === "approved")) {
    expense.status = "approved";
    expense.approvedAmount = approvedAmount;
    const tx = await Transaction.create({
      company: expense.company,
      employee: expense.employee,
      type: "allowance",
      amount: approvedAmount,
      date: new Date(),
      remark: `Reimbursement: ${expense.title}`,
    });
    expense.transaction = tx._id;
  }
  await expense.save();
  if (expense.status === "approved" || expense.status === "rejected") {
    if (emp?.user)
      notifyUsers(req.user.company, [emp.user], {
        type: "general",
        employee: expense.employee,
        title: expense.status === "approved" ? "Expense approved" : "Expense rejected",
        message:
          expense.status === "approved"
            ? `Your claim "${expense.title}" was approved for ₹${expense.approvedAmount}`
            : `Your claim "${expense.title}" was rejected${step.note ? `: ${step.note}` : ""}`,
      });
  }
  res.json({ success: true, data: expense });
});

const deleteExpense = asyncHandler(async (req, res) => {
  const emp = await selfEmployee(req);
  const expense = await Expense.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!expense || !emp || String(expense.employee) !== String(emp._id)) {
    res.status(404);
    throw new Error("Claim not found");
  }
  if (
    !["draft", "pending"].includes(expense.status) ||
    expense.steps.some((s) => s.status !== "pending")
  ) {
    res.status(400);
    throw new Error("Only drafts and untouched pending claims can be withdrawn");
  }
  billsOf(expense).forEach((b) =>
    fs.unlink(path.join(BILL_DIR, path.basename(b)), () => {}),
  );
  await expense.deleteOne();
  res.json({ success: true });
});

// Same access rules for the direct download and the signed link.
async function billFor(req, res) {
  const expense = await Expense.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  const file = expense ? billsOf(expense)[Number(req.params.index) || 0] : null;
  if (!file) {
    res.status(404);
    throw new Error("Bill not found");
  }
  if (req.user.role === "employee") {
    const emp = await selfEmployee(req);
    if (!emp || String(expense.employee) !== String(emp._id)) {
      res.status(403);
      throw new Error("Not allowed");
    }
  } else if (req.user.role === "department_head") {
    const emp = await Employee.findById(expense.employee).select("department");
    if (String(emp?.department) !== String(req.user.department)) {
      res.status(403);
      throw new Error("Not allowed");
    }
  }
  return path.basename(file);
}

const downloadBill = asyncHandler(async (req, res) => {
  res.sendFile(path.join(BILL_DIR, await billFor(req, res)));
});

// Short-lived signed link so the mobile app can open a bill in the phone's browser / PDF viewer.
const getBillLink = asyncHandler(async (req, res) => {
  const file = await billFor(req, res);
  const token = jwt.sign({ purpose: "expense-bill", file }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "2m",
  });
  res.json({ success: true, data: { path: `/expense-claims/bill-file/${token}` } });
});

// Public: the token is the credential. Never usable as a login session (it carries a purpose).
const serveBillByToken = asyncHandler(async (req, res) => {
  let decoded;
  try {
    decoded = jwt.verify(req.params.token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch (_) {
    res.status(401);
    throw new Error("Link expired");
  }
  if (decoded.purpose !== "expense-bill") {
    res.status(401);
    throw new Error("Invalid link");
  }
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(BILL_DIR, path.basename(decoded.file)));
});

const getWorkflow = asyncHandler(async (req, res) => {
  const wf = await ApprovalWorkflow.findOne({
    company: req.user.company,
    type: "expense",
  }).lean();
  res.json({
    success: true,
    data: wf?.steps || [{ role: "hr_manager", aboveAmount: 0 }],
  });
});

const saveWorkflow = asyncHandler(async (req, res) => {
  const steps = Array.isArray(req.body.steps) ? req.body.steps : [];
  if (!steps.length || steps.length > 4 || steps.some((s) => !ROLES.includes(s.role))) {
    res.status(400);
    throw new Error("Add 1-4 steps, each with a valid approver role");
  }
  const clean = steps.map((s) => ({
    role: s.role,
    aboveAmount: Math.max(0, Number(s.aboveAmount) || 0),
  }));
  const wf = await ApprovalWorkflow.findOneAndUpdate(
    { company: req.user.company, type: "expense" },
    { steps: clean },
    { upsert: true, new: true },
  );
  res.json({ success: true, data: wf.steps });
});

// HR settles an approved claim outside payroll (bank transfer, UPI, cash, cheque).
const markPaid = asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({ _id: req.params.id, company: req.user.company });
  if (!expense || expense.status !== "approved") {
    res.status(404);
    throw new Error("Approved claim not found");
  }
  const { mode, reference, paidOn } = req.body;
  const when = paidOn ? new Date(paidOn) : new Date();
  if (!PAY_MODES.includes(mode) || isNaN(when) || when > new Date()) {
    res.status(400);
    throw new Error("Choose a payment mode and a valid payment date");
  }
  // Remove the queued payroll allowance so the employee is not paid twice.
  if (expense.transaction) {
    const del = await Transaction.deleteOne({ _id: expense.transaction, status: "pending" });
    if (!del.deletedCount) {
      res.status(400);
      throw new Error("Payroll already picked up this claim");
    }
    expense.transaction = undefined;
  }
  expense.payment = {
    mode,
    paidOn: when,
    reference: String(reference || "").slice(0, 100),
    paidBy: req.user._id,
  };
  expense.status = "paid";
  await expense.save();
  res.json({ success: true, data: expense });
});

const getPolicyHandler = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getPolicy(req.user.company) });
});

const savePolicy = asyncHandler(async (req, res) => {
  const limits = {};
  for (const c of CATEGORIES) {
    const v = Number(req.body.limits?.[c]);
    if (v > 0) limits[c] = v;
  }
  const billRequiredAbove = Math.max(0, Number(req.body.billRequiredAbove) || 0);
  await ExpensePolicy.findOneAndUpdate(
    { company: req.user.company },
    { limits, billRequiredAbove },
    { upsert: true },
  );
  res.json({ success: true, data: { limits, billRequiredAbove } });
});

module.exports = {
  getBillLink,
  serveBillByToken,
  updateExpense,
  resubmitExpense,
  markPaid,
  getPolicy: getPolicyHandler,
  savePolicy,
  getExpenses,
  createExpense,
  actOnExpense,
  deleteExpense,
  downloadBill,
  getWorkflow,
  saveWorkflow,
};
