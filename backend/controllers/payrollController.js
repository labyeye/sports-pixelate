const asyncHandler = require("express-async-handler");
const Payroll = require("../models/Payroll");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const DeductionRule = require("../models/DeductionRule");
const Transaction = require("../models/Transaction");
const Loan = require("../models/Loan");
const { safePagination } = require("../middleware/validate");
const { sendSalaryPaid } = require("../services/whatsappService");
const { generatePayslipPdf } = require("../services/pdfService");
const Setting = require("../models/Setting");
const { computeEmployeePayroll } = require("../utils/payrollCalc");
const logger = require("../utils/logger");

// Payroll lifecycle: processed (calculated, awaiting payment) -> paid.
// "cancelled" exists for records voided by an admin.
const PAYROLL_STATUS = ["processed", "paid", "cancelled"];

/**
 * GET /payroll — paginated payroll records for the caller's company.
 * Optional filters: month, year, employeeId, status.
 */
const getPayrolls = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { month, year, employeeId, status } = req.query;

  const filter = { company: req.user.company };
  if (month) {
    const m = parseInt(month);
    if (!isNaN(m)) filter.month = m;
  }
  if (year) {
    const y = parseInt(year);
    if (!isNaN(y)) filter.year = y;
  }
  if (status && PAYROLL_STATUS.includes(status)) filter.status = status;

  if (employeeId) {
    const emp = await Employee.findOne({
      _id: employeeId,
      company: req.user.company,
    });
    if (!emp) return res.json({ success: true, data: [], total: 0 });
    filter.employee = employeeId;
  }

  const total = await Payroll.countDocuments(filter);
  const payrolls = await Payroll.find(filter)
    .populate({
      path: "employee",
      select: "firstName lastName employeeId designation phone avatar",
      populate: { path: "department", select: "name" },
    })
    .sort({ year: -1, month: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: payrolls,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

/**
 * POST /payroll/process — calculates and saves payroll for a month.
 *
 * Per active employee (skipped if already processed or no attendance exists):
 *   dailyRate  = monthly salary / working days
 *   hourlyRate = dailyRate / shift hours
 *   earned     = hours worked (from shift start, capped at shift end) x hourlyRate
 * then adds overtime and allowances from pending transactions, and subtracts
 * absent, half-day and late deductions, penalties and active-loan EMIs.
 * Shift times are IST.
 *
 * `force: true` deletes and recalculates this month's records, but never paid ones.
 */
const processPayroll = asyncHandler(async (req, res) => {
  const { month, year, employeeIds, employees: empIds, force } = req.body;
  const m = parseInt(month),
    y = parseInt(year);
  if (isNaN(m) || m < 1 || m > 12 || isNaN(y) || y < 2000 || y > 2100) {
    res.status(400);
    throw new Error("Valid month (1-12) and year are required");
  }

  const empFilter = { company: req.user.company, status: "active" };
  const idList = employeeIds || empIds;
  if (Array.isArray(idList) && idList.length > 0) {
    empFilter._id = { $in: idList };
  }
  const employees = await Employee.find(empFilter).populate("shift");

  const deductionRule = await DeductionRule.findOne({
    company: req.user.company,
  });

  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 0);

  // force=true: delete existing records for this month and reprocess
  if (force) {
    const empIds = employees.map((e) => e._id);
    await Payroll.deleteMany({
      company: req.user.company,
      month: m,
      year: y,
      employee: { $in: empIds },
      status: { $ne: "paid" }, // never delete paid payrolls
    });
  }

  const payrolls = [];

  for (const emp of employees) {
    const existing = await Payroll.findOne({
      employee: emp._id,
      month: m,
      year: y,
    });
    if (existing) continue;

    const attendances = await Attendance.find({
      employee: emp._id,
      date: { $gte: startDate, $lte: endDate },
    });

    if (attendances.length === 0) continue;

    const txMonthStart = new Date(y, m - 1, 1);
    const txMonthEnd = new Date(y, m, 0, 23, 59, 59);
    const pendingTx = await Transaction.find({
      employee: emp._id,
      company: req.user.company,
      status: "pending",
      date: { $gte: txMonthStart, $lte: txMonthEnd },
    });
    const activeLoans = await Loan.find({
      employee: emp._id,
      company: req.user.company,
      status: "active",
    });

    const { record, loanUpdates, txIds } = computeEmployeePayroll({
      emp,
      attendances,
      year: y,
      month: m,
      deductionRule,
      pendingTx,
      activeLoans,
    });
    const { overtimeHoursRaw, ...figures } = record;

    payrolls.push({
      company: req.user.company,
      employee: emp._id,
      month: m,
      year: y,
      ...figures,
      weeklyOffDays: 0,
      overtimeHours: overtimeHoursRaw,
      status: "processed",
      processedBy: req.user._id,
    });

    for (const u of loanUpdates) {
      await Loan.findByIdAndUpdate(u.id, {
        remainingBalance: u.newBalance,
        ...(u.cleared ? { status: "cleared", clearedOn: new Date() } : {}),
      });
    }
    if (loanUpdates.length) {
      const newTotalLoan = activeLoans.reduce((sum, l) => {
        const upd = loanUpdates.find((u) => String(u.id) === String(l._id));
        return sum + (upd ? upd.newBalance : l.remainingBalance);
      }, 0);
      await Employee.findByIdAndUpdate(emp._id, { loanBalance: newTotalLoan });
    }

    if (txIds.length) {
      await Transaction.updateMany(
        { _id: { $in: txIds } },
        { status: "applied" },
      );
    }
  }

  if (payrolls.length) {
    await Payroll.insertMany(payrolls);
  }
  res.json({ success: true, message: `${payrolls.length} payrolls processed` });
});

/**
 * PUT /payroll/:id — manual correction of a payroll record. Only the fields in
 * `allowed` can be changed; amounts are written as given, not recalculated.
 */
const updatePayroll = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!payroll) {
    res.status(404);
    throw new Error("Payroll not found");
  }

  const allowed = [
    "basicSalary",
    "hra",
    "da",
    "ta",
    "grossSalary",
    "pf",
    "esi",
    "tds",
    "totalDeductions",
    "netSalary",
    "workingDays",
    "presentDays",
    "status",
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) payroll[key] = req.body[key];
  }

  await payroll.save();
  res.json({ success: true, data: payroll });
});

/**
 * PUT /payroll/:id/paid — marks one payroll as paid, records the payment mode,
 * and sends the WhatsApp salary notification in the background (a failed
 * message never fails the request).
 */
const markPaid = asyncHandler(async (req, res) => {
  const { paymentMode } = req.body;

  const payroll = await Payroll.findOne({
    _id: req.params.id,
    company: req.user.company,
  }).populate(
    "employee",
    "firstName lastName employeeId designation phone salary",
  );
  if (!payroll) {
    res.status(404);
    throw new Error("Payroll not found");
  }

  payroll.status = "paid";
  payroll.paidAt = new Date();
  if (paymentMode) payroll.paymentMode = paymentMode;
  await payroll.save();

  if (payroll.employee?.phone) {
    (async () => {
      try {
        const months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        const period = `${months[(payroll.month || 1) - 1]} ${payroll.year}`;
        const companySetting = await Setting.findOne({
          company: req.user.company,
        })
          .select(
            "companyName companyAddress logoUrl chequeLogoX chequeLogoY chequeLogoW",
          )
          .lean();
        const companyInfo = {
          name: companySetting?.companyName || "",
          address: companySetting?.companyAddress || "",
          logo: companySetting?.logoUrl || "",
          chequeLogoX: companySetting?.chequeLogoX ?? 10,
          chequeLogoY: companySetting?.chequeLogoY ?? 20,
          chequeLogoW: companySetting?.chequeLogoW ?? 60,
        };
        const pdfBuffer = await generatePayslipPdf(
          payroll.toObject(),
          payroll.employee,
          companyInfo,
        );
        await sendSalaryPaid(
          payroll.employee.phone,
          {
            firstName: payroll.employee.firstName,
            period,
            basicSalary: payroll.basicSalary,
            allowances: payroll.otherAllowances || 0,
            otPay: payroll.otPay || 0,
            grossSalary: payroll.grossSalary,
            totalDeductions: payroll.totalDeductions,
            netSalary: payroll.netSalary,
            presentDays: payroll.presentDays,
            workingDays: payroll.workingDays,
            paymentMode: paymentMode || "Bank Transfer",
            paidOn: payroll.paidAt,
          },
          req.user.company,
          pdfBuffer,
        );
      } catch (err) {
        console.error("[Payroll] WA sendSalaryPaid failed:", err.message);
      }
    })();
  } else {
    console.warn(
      `[Payroll] No phone for employee ${payroll.employee?._id} — WA skipped`,
    );
  }

  res.json({ success: true, data: payroll });
});

/**
 * POST /payroll/bulk-paid — marks every "processed" payroll of a month as paid
 * and notifies each employee. Already-paid records are left untouched.
 */
const bulkMarkPaid = asyncHandler(async (req, res) => {
  const { month, year, paymentMode } = req.body;
  const m = parseInt(month),
    y = parseInt(year);

  const payrolls = await Payroll.find({
    company: req.user.company,
    month: m,
    year: y,
    status: "processed",
  }).populate(
    "employee",
    "firstName lastName employeeId designation phone salary",
  );

  if (!payrolls.length) {
    return res.json({ success: true, message: "0 payrolls marked as paid" });
  }

  const paidAt = new Date();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const period = `${months[m - 1]} ${y}`;

  await Payroll.updateMany(
    { _id: { $in: payrolls.map((p) => p._id) } },
    {
      $set: { status: "paid", paidAt, ...(paymentMode ? { paymentMode } : {}) },
    },
  );

  // Fire WA notifications with PDF (non-blocking)
  (async () => {
    try {
      const companySetting = await Setting.findOne({
        company: req.user.company,
      })
        .select(
          "companyName companyAddress logoUrl chequeLogoX chequeLogoY chequeLogoW",
        )
        .lean();
      const companyInfo = {
        name: companySetting?.companyName || "",
        address: companySetting?.companyAddress || "",
        logo: companySetting?.logoUrl || "",
        chequeLogoX: companySetting?.chequeLogoX ?? 10,
        chequeLogoY: companySetting?.chequeLogoY ?? 20,
        chequeLogoW: companySetting?.chequeLogoW ?? 60,
      };
      for (const payroll of payrolls) {
        if (!payroll.employee?.phone) continue;
        try {
          const pdfBuffer = await generatePayslipPdf(
            payroll.toObject(),
            payroll.employee,
            companyInfo,
          );
          await sendSalaryPaid(
            payroll.employee.phone,
            {
              firstName: payroll.employee.firstName,
              period,
              basicSalary: payroll.basicSalary,
              allowances: payroll.otherAllowances || 0,
              otPay: payroll.otPay || 0,
              grossSalary: payroll.grossSalary,
              totalDeductions: payroll.totalDeductions,
              netSalary: payroll.netSalary,
              presentDays: payroll.presentDays,
              workingDays: payroll.workingDays,
              paymentMode: paymentMode || "Bank Transfer",
              paidOn: paidAt,
            },
            req.user.company,
            pdfBuffer,
          );
        } catch (err) {
          console.error(
            `[Payroll] WA bulk notify failed for ${payroll.employee._id}:`,
            err.message,
          );
        }
      }
    } catch (err) {
      console.error("[Payroll] WA bulk notify setup failed:", err.message);
    }
  })();

  res.json({
    success: true,
    message: `${payrolls.length} payrolls marked as paid`,
  });
});

/**
 * GET /payroll/my — the logged-in employee's own payslips (self-service).
 * Falls back to matching the employee by email and links the account on first hit.
 */
const getMyPayrolls = asyncHandler(async (req, res) => {
  let emp = await Employee.findOne({
    user: req.user._id,
    company: req.user.company,
  });
  if (!emp && req.user.email && req.user.company) {
    emp = await Employee.findOne({
      email: req.user.email.toLowerCase(),
      company: req.user.company,
    });
    if (emp) {
      await Employee.findByIdAndUpdate(emp._id, { user: req.user._id });
    }
  }
  if (!emp) return res.json({ success: true, data: [] });

  const { month, year } = req.query;
  const filter = { employee: emp._id, company: req.user.company };
  if (month) filter.month = parseInt(month);
  if (year) filter.year = parseInt(year);

  const payrolls = await Payroll.find(filter).sort({ year: -1, month: -1 });
  res.json({ success: true, data: payrolls });
});

/**
 * POST /payroll/preview — dry run of processPayroll: same calculation, nothing
 * saved. Flags employees whose month is `alreadyProcessed`.
 * Uses the same utils/payrollCalc as processPayroll, so figures always match.
 */
const previewPayroll = asyncHandler(async (req, res) => {
  const { month, year, employeeIds } = req.body;
  const m = parseInt(month),
    y = parseInt(year);
  if (isNaN(m) || m < 1 || m > 12 || isNaN(y) || y < 2000 || y > 2100) {
    res.status(400);
    throw new Error("Valid month (1-12) and year are required");
  }

  const empFilter = { company: req.user.company, status: "active" };
  if (Array.isArray(employeeIds) && employeeIds.length > 0) {
    empFilter._id = { $in: employeeIds };
  }
  const employees = await Employee.find(empFilter).populate("shift");
  const deductionRule = await DeductionRule.findOne({
    company: req.user.company,
  });

  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 0);

  const previews = [];

  for (const emp of employees) {
    const attendances = await Attendance.find({
      employee: emp._id,
      date: { $gte: startDate, $lte: endDate },
    });

    if (attendances.length === 0) continue;

    const txMonthStart = new Date(y, m - 1, 1);
    const txMonthEnd = new Date(y, m, 0, 23, 59, 59);
    const pendingTx = await Transaction.find({
      employee: emp._id,
      company: req.user.company,
      status: "pending",
      date: { $gte: txMonthStart, $lte: txMonthEnd },
    });
    const activeLoans = await Loan.find({
      employee: emp._id,
      company: req.user.company,
      status: "active",
    });

    const { record } = computeEmployeePayroll({
      emp,
      attendances,
      year: y,
      month: m,
      deductionRule,
      pendingTx,
      activeLoans,
    });
    const alreadyProcessed = !!(await Payroll.findOne({
      employee: emp._id,
      month: m,
      year: y,
    }));

    previews.push({
      employee: {
        _id: emp._id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        employeeId: emp.employeeId,
        designation: emp.designation,
      },
      month: m,
      year: y,
      basicSalary: record.basicSalary,
      earnedBasic: record.earnedBasic,
      totalWorkHours: record.totalWorkHours,
      hourlyRate: record.hourlyRate,
      otherAllowances: record.otherAllowances,
      otPay: record.otPay,
      grossSalary: record.grossSalary,
      lateDeductionAmount: record.lateDeductionAmount,
      halfDayDeduction: record.halfDayDeduction,
      absentDays: record.absentDays,
      absentDeduction: record.absentDeduction,
      penaltyAmount: record.penaltyAmount,
      loanDeduction: record.loanDeduction,
      totalDeductions: record.totalDeductions,
      netSalary: record.netSalary,
      workingDays: record.workingDays,
      presentDays: record.presentDays,
      leaveDays: record.leaveDays,
      overtimeHours: parseFloat(record.overtimeHoursRaw.toFixed(2)),
      alreadyProcessed,
    });
  }

  res.json({ success: true, data: previews });
});

/**
 * PATCH /payroll/:id/slip-received — records whether the employee confirmed
 * receiving the payslip ("received" | "not_received"), set from the WhatsApp
 * reply buttons or by HR.
 */
const markSlipReceived = asyncHandler(async (req, res) => {
  const { status } = req.body; // "received" | "not_received"
  logger.info(
    `[Payroll] markSlipReceived → id=${req.params.id} status=${status} user=${req.user._id}`,
  );
  if (!["received", "not_received"].includes(status)) {
    res.status(400);
    throw new Error("status must be 'received' or 'not_received'");
  }
  const payroll = await Payroll.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!payroll) {
    logger.warn(
      `[Payroll] markSlipReceived → payroll ${req.params.id} not found`,
    );
    res.status(404);
    throw new Error("Payroll not found");
  }
  payroll.slipReceived = status;
  payroll.slipReceivedAt = new Date();
  payroll.slipReceivedBy = req.user._id;
  await payroll.save();
  logger.info(
    `[Payroll] markSlipReceived ✅ → payroll=${payroll._id} slipReceived=${status}`,
  );
  res.json({ success: true, data: payroll });
});

module.exports = {
  getPayrolls,
  getMyPayrolls,
  processPayroll,
  previewPayroll,
  updatePayroll,
  markPaid,
  bulkMarkPaid,
  markSlipReceived,
};
