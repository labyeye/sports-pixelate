const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Loan = require("../models/Loan");
const Employee = require("../models/Employee");
const User = require("../models/User");
const Company = require("../models/Company");
const {
  sendLoanSubmitted,
  sendLoanApproved,
  sendLoanRejected,
  sendLoanAppliedHR,
} = require("../services/whatsappService");

async function syncLoanBalance(employeeId) {
  const empObjId = new mongoose.Types.ObjectId(String(employeeId));
  const result = await Loan.aggregate([
    { $match: { employee: empObjId, status: "active" } },
    { $group: { _id: null, total: { $sum: "$remainingBalance" } } },
  ]);
  const total = result[0]?.total ?? 0;
  await Employee.findByIdAndUpdate(employeeId, { loanBalance: total });
}

async function resolveSelfEmployee(req) {
  let emp = await Employee.findOne({ user: req.user._id });
  if (!emp && req.user.email && req.user.company) {
    emp = await Employee.findOne({
      email: req.user.email.toLowerCase(),
      company: req.user.company,
    });
    if (emp) await Employee.findByIdAndUpdate(emp._id, { user: req.user._id });
  }
  return emp;
}

const getLoans = asyncHandler(async (req, res) => {
  const { employee, status } = req.query;
  const filter = { company: req.user.company };
  if (status) filter.status = status;

  if (req.user.role === "employee") {
    const emp = await resolveSelfEmployee(req);
    if (!emp) {
      res.status(404);
      throw new Error("Employee record not found for your account");
    }
    filter.employee = emp._id;
  } else if (employee) {
    filter.employee = employee;
  }

  const loans = await Loan.find(filter)
    .populate("employee", "firstName lastName employeeId department avatar")
    .sort({ createdAt: -1 });
  res.json({ success: true, data: loans });
});

const createLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.create({
    ...req.body,
    company: req.user.company,
    remainingBalance: req.body.amount,
  });
  await syncLoanBalance(loan.employee);
  const populated = await Loan.findById(loan._id).populate(
    "employee",
    "firstName lastName employeeId avatar",
  );
  res.status(201).json({ success: true, data: populated });
});

// Employee self-service: request a loan/advance (starts as "pending")
const requestLoan = asyncHandler(async (req, res) => {
  const { type, amount, tenureMonths, reason } = req.body;

  const emp = await resolveSelfEmployee(req);
  if (!emp) {
    res.status(404);
    throw new Error("Employee record not found for your account");
  }

  const amountNum = Number(amount);
  if (!amountNum || amountNum <= 0) {
    res.status(400);
    throw new Error("A valid amount is required");
  }
  const tenureNum = Number(tenureMonths) || 0;
  if (tenureNum < 0 || tenureNum > 360) {
    res.status(400);
    throw new Error("Invalid tenure");
  }

  const loan = await Loan.create({
    company: req.user.company,
    employee: emp._id,
    type: type === "advance" ? "advance" : "loan",
    amount: amountNum,
    remainingBalance: amountNum,
    tenureMonths: tenureNum,
    monthlyEmi: tenureNum > 0 ? Math.round(amountNum / tenureNum) : 0,
    reason: (reason || "").trim().slice(0, 500),
    status: "pending",
    requestedBy: req.user._id,
  });

  try {
    if (emp.phone) {
      await sendLoanSubmitted(
        emp.phone,
        {
          firstName: emp.firstName,
          type: loan.type,
          amount: loan.amount,
          tenureMonths: loan.tenureMonths,
        },
        req.user.company,
      );
    }

    const company = await Company.findById(req.user.company).select("phone");
    const hrUsers = await User.find({
      company: req.user.company,
      role: { $in: ["super_admin", "hr_manager"] },
    }).select("phone role");
    for (const hr of hrUsers) {
      const phone =
        hr.phone || (hr.role === "super_admin" ? company?.phone : null);
      if (phone) {
        await sendLoanAppliedHR(
          phone,
          {
            type: loan.type,
            empName: `${emp.firstName} ${emp.lastName}`,
            empId: emp.employeeId,
            amount: loan.amount,
            tenureMonths: loan.tenureMonths,
            reason: loan.reason,
          },
          req.user.company,
        );
      }
    }
  } catch (err) {
    console.error("[Loan] Notification failed:", err.message);
  }

  const populated = await Loan.findById(loan._id).populate(
    "employee",
    "firstName lastName employeeId avatar",
  );
  res.status(201).json({ success: true, data: populated });
});

// Owner/HR: approve or reject a pending loan request
const updateLoanStatus = asyncHandler(async (req, res) => {
  const { status, rejectionReason, monthlyEmi } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    res.status(400);
    throw new Error("Status must be 'approved' or 'rejected'");
  }

  const loan = await Loan.findOne({
    _id: req.params.id,
    company: req.user.company,
  }).populate("employee", "firstName lastName employeeId phone");
  if (!loan) {
    res.status(404);
    throw new Error("Loan not found");
  }
  if (loan.status !== "pending") {
    res.status(400);
    throw new Error("Only pending requests can be approved or rejected");
  }

  if (status === "approved") {
    loan.status = "active";
    loan.approvedBy = req.user._id;
    loan.approvedAt = new Date();
    if (monthlyEmi !== undefined) loan.monthlyEmi = Number(monthlyEmi) || 0;
    loan.disbursedOn = new Date();
  } else {
    loan.status = "rejected";
    loan.rejectionReason = (rejectionReason || "").trim().slice(0, 500);
  }
  await loan.save();
  await syncLoanBalance(loan.employee._id);

  try {
    if (loan.employee?.phone) {
      if (status === "approved") {
        await sendLoanApproved(
          loan.employee.phone,
          {
            firstName: loan.employee.firstName,
            type: loan.type,
            amount: loan.amount,
            monthlyEmi: loan.monthlyEmi,
          },
          req.user.company,
        );
      } else {
        await sendLoanRejected(
          loan.employee.phone,
          {
            firstName: loan.employee.firstName,
            type: loan.type,
            amount: loan.amount,
            reason: loan.rejectionReason,
          },
          req.user.company,
        );
      }
    }
  } catch (err) {
    console.error("[Loan] Notification failed:", err.message);
  }

  const populated = await Loan.findById(loan._id).populate(
    "employee",
    "firstName lastName employeeId avatar",
  );
  res.json({ success: true, data: populated });
});

const updateLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    req.body,
    { new: true },
  ).populate("employee", "firstName lastName employeeId avatar");
  if (!loan)
    return res.status(404).json({ success: false, message: "Loan not found" });
  await syncLoanBalance(loan.employee._id);
  res.json({ success: true, data: loan });
});

const deleteLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  if (loan) await syncLoanBalance(loan.employee);
  res.json({ success: true, message: "Deleted" });
});

// Bulk create loans/advances from a parsed spreadsheet (Excel import), for
// backfilling historical records — created directly as "active", bypassing
// the pending-approval flow used by requestLoan/updateLoanStatus.
const bulkImportLoans = asyncHandler(async (req, res) => {
  const { loans: rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400);
    throw new Error("loans array is required");
  }
  if (rows.length > 200) {
    res.status(400);
    throw new Error("Maximum 200 loans per import");
  }

  const allEmployees = await Employee.find({
    company: req.user.company,
  }).select("employeeId firstName lastName");

  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const empMatch = allEmployees.find(
        (e) =>
          e.employeeId?.toLowerCase() ===
          String(row.employeeId || "").toLowerCase(),
      );
      const amount = Number(row.amount);

      if (!empMatch || !Number.isFinite(amount) || amount <= 0) {
        results.push({
          row: i + 1,
          status: "error",
          message: !empMatch
            ? `No employee found with employeeId "${row.employeeId}"`
            : "amount is required and must be greater than 0",
        });
        continue;
      }

      const remainingBalance = Number.isFinite(Number(row.remainingBalance))
        ? Number(row.remainingBalance)
        : amount;

      const loan = await Loan.create({
        company: req.user.company,
        employee: empMatch._id,
        type: row.type === "advance" ? "advance" : "loan",
        amount,
        remainingBalance,
        monthlyEmi: Number(row.monthlyEmi) || 0,
        tenureMonths: Number(row.tenureMonths) || 0,
        reason: row.reason || undefined,
        disbursedOn: row.disbursedOn || Date.now(),
        status: ["active", "cleared", "paused"].includes(row.status)
          ? row.status
          : "active",
        remarks: row.remarks || undefined,
      });
      await syncLoanBalance(loan.employee);

      results.push({
        row: i + 1,
        status: "success",
        employee: `${empMatch.firstName} ${empMatch.lastName}`,
      });
    } catch (err) {
      results.push({ row: i + 1, status: "error", message: err.message });
    }
  }

  const imported = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;

  res.json({ success: true, imported, failed, results });
});

module.exports = {
  getLoans,
  createLoan,
  requestLoan,
  updateLoanStatus,
  updateLoan,
  deleteLoan,
  bulkImportLoans,
};
