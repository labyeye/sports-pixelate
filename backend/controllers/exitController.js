const asyncHandler = require("express-async-handler");
const ExitRecord = require("../models/ExitRecord");
const Employee = require("../models/Employee");
const Student = require("../models/Student");
const User = require("../models/User");
const Loan = require("../models/Loan");
const Payroll = require("../models/Payroll");
const InventoryItem = require("../models/InventoryItem");
const StudentSubscription = require("../models/StudentSubscription");
const { safePagination, escapeRegex } = require("../middleware/validate");
const { logAudit } = require("../utils/auditLogger");
const { notifyOwners } = require("../services/inAppNotify");

const EMPLOYEE_EXIT_TYPES = [
  "resignation",
  "termination",
  "retirement",
  "contract_end",
  "absconded",
  "other",
];
const STUDENT_EXIT_TYPES = [
  "course_completed",
  "withdrawn",
  "relocated",
  "fee_issue",
  "injury",
  "other",
];

const EMPLOYEE_CHECKLIST = [
  { key: "handover", label: "Work / batch handover completed" },
  { key: "inventory", label: "Equipment & inventory returned" },
  { key: "loans", label: "Loans & advances cleared" },
  { key: "salary", label: "Final salary / settlement processed" },
  { key: "documents", label: "Experience / relieving letter issued" },
  { key: "access", label: "App & device access revoked" },
  { key: "interview", label: "Exit interview done", required: false },
];
const STUDENT_CHECKLIST = [
  { key: "inventory", label: "Equipment & kit returned" },
  { key: "dues", label: "Fees / dues cleared" },
  { key: "subscription", label: "Subscription closed" },
  { key: "documents", label: "Certificate / records handed over", required: false },
  { key: "feedback", label: "Feedback collected from student / parent", required: false },
];

const buildChecklist = (personType) =>
  (personType === "employee" ? EMPLOYEE_CHECKLIST : STUDENT_CHECKLIST).map(
    (c) => ({ required: true, done: false, notes: "", ...c }),
  );

// Live "what is still outstanding for this person" check, computed fresh on
// every read so the clearance screen is never stale.
async function outstandingFor(record) {
  const company = record.company;
  const out = { loans: [], inventory: [], subscriptions: [], payrolls: 0 };

  if (record.personType === "employee" && record.employee) {
    out.loans = await Loan.find({
      company,
      employee: record.employee,
      status: { $in: ["active", "pending", "paused"] },
      remainingBalance: { $gt: 0 },
    })
      .select("type amount remainingBalance status")
      .lean();
    out.payrolls = await Payroll.countDocuments({
      employee: record.employee,
      status: { $ne: "paid" },
    });
  }

  const personId = record.employee || record.student;
  const model = record.personType === "employee" ? "Employee" : "Student";
  const items = await InventoryItem.find({
    company,
    assignments: {
      $elemMatch: {
        assignedTo: personId,
        assignedToModel: model,
        returnedAt: { $exists: false },
      },
    },
  })
    .select("name assignments")
    .lean();
  out.inventory = items.map((i) => ({
    _id: i._id,
    name: i.name,
    quantity: i.assignments
      .filter(
        (a) => String(a.assignedTo) === String(personId) && !a.returnedAt,
      )
      .reduce((s, a) => s + (a.quantity || 1), 0),
  }));

  if (record.personType === "student" && record.student) {
    out.subscriptions = await StudentSubscription.find({
      company,
      student: record.student,
      status: { $in: ["active", "pending_renewal"] },
    })
      .select("planName amount amountPaid renewalDate status paymentStatus")
      .lean();
  }
  return out;
}

async function loadPerson(personType, personId, company) {
  if (personType === "employee") {
    return Employee.findOne({ _id: personId, company });
  }
  return Student.findOne({ _id: personId, company });
}

const withProgress = (doc) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const req = (obj.checklist || []).filter((c) => c.required);
  obj.progress = {
    done: (obj.checklist || []).filter((c) => c.done).length,
    total: (obj.checklist || []).length,
    requiredDone: req.filter((c) => c.done).length,
    requiredTotal: req.length,
  };
  return obj;
};

const getExits = asyncHandler(async (req, res) => {
  const { personType, status, search } = req.query;
  const { page, limit, skip } = safePagination(req.query);
  const filter = { company: req.user.company };
  if (["employee", "student"].includes(personType)) filter.personType = personType;
  if (status) filter.status = status;
  if (search) {
    const re = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ personName: re }, { personCode: re }];
  }
  const [total, rows, counts] = await Promise.all([
    ExitRecord.countDocuments(filter),
    ExitRecord.find(filter)
      .populate("employee", "avatar designation")
      .populate("student", "avatar sport batch")
      .sort({ exitDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ExitRecord.aggregate([
      { $match: { company: req.user.company } },
      { $group: { _id: { t: "$personType", s: "$status" }, n: { $sum: 1 } } },
    ]),
  ]);

  const summary = {
    total: 0,
    inProgress: 0,
    completed: 0,
    staff: 0,
    students: 0,
  };
  for (const c of counts) {
    if (c._id.s === "cancelled" || c._id.s === "reinstated") continue;
    summary.total += c.n;
    if (c._id.s === "completed") summary.completed += c.n;
    else summary.inProgress += c.n;
    if (c._id.t === "employee") summary.staff += c.n;
    else summary.students += c.n;
  }

  res.json({
    success: true,
    data: rows.map(withProgress),
    summary,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const getExit = asyncHandler(async (req, res) => {
  const record = await ExitRecord.findOne({
    _id: req.params.id,
    company: req.user.company,
  })
    .populate("employee", "avatar designation phone email department")
    .populate("student", "avatar sport batch guardians");
  if (!record) {
    res.status(404);
    throw new Error("Exit record not found");
  }
  const outstanding = await outstandingFor(record);
  res.json({ success: true, data: withProgress(record), outstanding });
});

const initiateExit = asyncHandler(async (req, res) => {
  const { personType, personId, exitType, reason, noticeDate, exitDate, notes } =
    req.body;
  if (!["employee", "student"].includes(personType) || !personId) {
    res.status(400);
    throw new Error("personType and personId are required");
  }
  const allowed =
    personType === "employee" ? EMPLOYEE_EXIT_TYPES : STUDENT_EXIT_TYPES;
  if (!allowed.includes(exitType)) {
    res.status(400);
    throw new Error(`exitType must be one of: ${allowed.join(", ")}`);
  }
  const exit = exitDate ? new Date(exitDate) : null;
  if (!exit || isNaN(exit.getTime())) {
    res.status(400);
    throw new Error("A valid exit date is required");
  }

  const person = await loadPerson(personType, personId, req.user.company);
  if (!person) {
    res.status(404);
    throw new Error(`${personType === "employee" ? "Staff member" : "Student"} not found`);
  }

  const open = await ExitRecord.findOne({
    company: req.user.company,
    [personType]: person._id,
    status: { $in: ["initiated", "in_clearance"] },
  });
  if (open) {
    res.status(409);
    throw new Error("An exit is already in progress for this person");
  }

  const record = await ExitRecord.create({
    company: req.user.company,
    personType,
    [personType]: person._id,
    personName: `${person.firstName} ${person.lastName}`.trim(),
    personCode: personType === "employee" ? person.employeeId : person.studentId,
    exitType,
    reason: reason || "",
    noticeDate: noticeDate ? new Date(noticeDate) : undefined,
    exitDate: exit,
    notes: notes || "",
    checklist: buildChecklist(personType),
    initiatedBy: req.user._id,
  });

  await logAudit(req, "exit_initiated", "ExitRecord", record._id, {
    personType,
    person: record.personName,
    exitType,
  });
  res.status(201).json({ success: true, data: withProgress(record) });
});

const EDITABLE = [
  "exitType",
  "reason",
  "noticeDate",
  "exitDate",
  "settlementAmount",
  "settlementNotes",
  "settlementPaid",
  "feedback",
  "eligibleForRehire",
  "notes",
];

const updateExit = asyncHandler(async (req, res) => {
  const record = await ExitRecord.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!record) {
    res.status(404);
    throw new Error("Exit record not found");
  }
  if (["completed", "cancelled", "reinstated"].includes(record.status)) {
    res.status(400);
    throw new Error(`A ${record.status} exit can't be edited`);
  }

  for (const f of EDITABLE) {
    if (req.body[f] === undefined) continue;
    if (f === "exitType") {
      const allowed =
        record.personType === "employee" ? EMPLOYEE_EXIT_TYPES : STUDENT_EXIT_TYPES;
      if (!allowed.includes(req.body[f])) {
        res.status(400);
        throw new Error("Invalid exit type for this person");
      }
    }
    if ((f === "noticeDate" || f === "exitDate") && req.body[f]) {
      const d = new Date(req.body[f]);
      if (isNaN(d.getTime())) {
        res.status(400);
        throw new Error(`Invalid ${f}`);
      }
      record[f] = d;
    } else if (f === "settlementAmount") {
      record[f] = Math.max(0, Number(req.body[f]) || 0);
    } else {
      record[f] = req.body[f];
    }
  }

  // Checklist toggles: [{ key, done, notes? }]
  if (Array.isArray(req.body.checklist)) {
    for (const patch of req.body.checklist) {
      const item = record.checklist.find((c) => c.key === patch.key);
      if (!item) continue;
      if (typeof patch.done === "boolean" && patch.done !== item.done) {
        item.done = patch.done;
        item.doneAt = patch.done ? new Date() : undefined;
        item.doneBy = patch.done ? req.user._id : undefined;
      }
      if (typeof patch.notes === "string") item.notes = patch.notes;
    }
  }

  record.status = record.checklist.some((c) => c.done) ? "in_clearance" : "initiated";
  await record.save();
  res.json({ success: true, data: withProgress(record) });
});

const completeExit = asyncHandler(async (req, res) => {
  const record = await ExitRecord.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!record) {
    res.status(404);
    throw new Error("Exit record not found");
  }
  if (!["initiated", "in_clearance"].includes(record.status)) {
    res.status(400);
    throw new Error(`This exit is already ${record.status}`);
  }

  const pendingRequired = record.checklist.filter((c) => c.required && !c.done);
  if (pendingRequired.length > 0 && !req.body.force) {
    res.status(400);
    throw new Error(
      `Clearance incomplete: ${pendingRequired.map((c) => c.label).join("; ")}`,
    );
  }

  const person = await loadPerson(
    record.personType,
    record.employee || record.student,
    req.user.company,
  );
  if (!person) {
    res.status(404);
    throw new Error("Person no longer exists");
  }

  record.previousStatus = person.status;
  person.exitDate = record.exitDate;
  if (record.personType === "employee") {
    person.status = ["termination", "absconded"].includes(record.exitType)
      ? "terminated"
      : "inactive";
    await person.save();
    // Staff can't log in once they've left.
    if (person.user) await User.updateOne({ _id: person.user }, { status: "inactive" });
  } else {
    person.status = "inactive";
    await person.save();
    // Close any open plans so they stop showing as renewals / dues.
    await StudentSubscription.updateMany(
      {
        company: req.user.company,
        student: person._id,
        status: { $in: ["active", "pending_renewal"] },
      },
      { status: "cancelled", autoRenew: false },
    );
  }

  record.status = "completed";
  record.completedAt = new Date();
  record.completedBy = req.user._id;
  await record.save();

  await logAudit(req, "exit_completed", "ExitRecord", record._id, {
    personType: record.personType,
    person: record.personName,
    forced: !!req.body.force,
  });
  await notifyOwners(req.user.company, {
    type: "general",
    title: "Exit completed",
    message: `${record.personName} (${record.personType === "employee" ? "staff" : "student"}) has been offboarded.`,
  });
  res.json({ success: true, data: withProgress(record) });
});

const cancelExit = asyncHandler(async (req, res) => {
  const record = await ExitRecord.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!record) {
    res.status(404);
    throw new Error("Exit record not found");
  }
  if (!["initiated", "in_clearance"].includes(record.status)) {
    res.status(400);
    throw new Error("Only an in-progress exit can be cancelled");
  }
  record.status = "cancelled";
  await record.save();
  await logAudit(req, "exit_cancelled", "ExitRecord", record._id, {
    person: record.personName,
  });
  res.json({ success: true, data: withProgress(record) });
});

// Undo a completed exit (person came back): restores their previous status.
const reinstate = asyncHandler(async (req, res) => {
  const record = await ExitRecord.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!record) {
    res.status(404);
    throw new Error("Exit record not found");
  }
  if (record.status !== "completed") {
    res.status(400);
    throw new Error("Only a completed exit can be reinstated");
  }
  const person = await loadPerson(
    record.personType,
    record.employee || record.student,
    req.user.company,
  );
  if (!person) {
    res.status(404);
    throw new Error("Person no longer exists");
  }
  person.status = record.previousStatus || "active";
  person.exitDate = undefined;
  await person.save();
  if (record.personType === "employee" && person.user) {
    await User.updateOne({ _id: person.user }, { status: "active" });
  }
  record.status = "reinstated";
  await record.save();
  await logAudit(req, "exit_reinstated", "ExitRecord", record._id, {
    person: record.personName,
  });
  res.json({ success: true, data: withProgress(record) });
});

module.exports = {
  getExits,
  getExit,
  initiateExit,
  updateExit,
  completeExit,
  cancelExit,
  reinstate,
};
