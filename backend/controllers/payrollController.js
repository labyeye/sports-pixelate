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
const { getEffectiveShift } = require("../utils/shiftUtils");

const PAYROLL_STATUS = ["processed", "paid", "cancelled"];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

// Returns minutes-since-midnight in IST for any Date or ISO string.
// All shift times (e.g. "09:00") are IST — so we compare apples-to-apples.
function istMinutes(date) {
  const d = new Date(date);
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

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

function getWorkingDays(year, month, workDaysPerWeek) {
  const days = workDaysPerWeek ?? 6;
  let count = 0;
  const end = new Date(year, month, 0).getDate();
  for (let d = 1; d <= end; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (days >= 7) count++;
    else if (days >= 6 && dow >= 1 && dow <= 6) count++;
    else if (dow >= 1 && dow <= 5) count++;
  }
  return count || 1;
}

function parseTime(timeStr) {
  const [h, m] = (timeStr || "00:00").split(":").map(Number);
  return { hour: h || 0, minute: m || 0 };
}

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

    const workDaysPerWeek = emp.workDaysPerWeek ?? 6;
    const workingDays = getWorkingDays(y, m, workDaysPerWeek);
    const salary = emp.salary ?? 0;
    const dailyRate = workingDays > 0 ? salary / workingDays : 0;

    const empShift = getEffectiveShift(emp);
    let shiftH, shiftM, shiftEndH, shiftEndM;

    if (empShift?.startTime) {
      const s = parseTime(empShift.startTime);
      shiftH = s.hour;
      shiftM = s.minute;
    } else {
      shiftH = deductionRule?.shiftStartHour ?? 9;
      shiftM = deductionRule?.shiftStartMinute ?? 0;
    }

    if (empShift?.endTime) {
      const e = parseTime(empShift.endTime);
      shiftEndH = e.hour;
      shiftEndM = e.minute;
    } else {
      shiftEndH = deductionRule?.shiftEndHour ?? 18;
      shiftEndM = deductionRule?.shiftEndMinute ?? 0;
    }

    // Hours-based payroll: earnedSalary = totalHoursWorked × hourlyRate
    const otEnabled = emp.otEnabled === true;
    // otRate is a multiplier (e.g. 1.5 = time-and-a-half). Default 1x if not set.
    const otMultiplier = emp.otRate && emp.otRate > 0 ? emp.otRate : 1;
    const shiftTotalMins = shiftEndH * 60 + shiftEndM - (shiftH * 60 + shiftM);
    const shiftHoursPerDay = shiftTotalMins > 0 ? shiftTotalMins / 60 : 8;
    const hourlyRate = dailyRate / shiftHoursPerDay;

    let presentDays = 0,
      leaveDays = 0,
      halfDayCount = 0,
      lateCount = 0,
      lateHoursLost = 0,
      absentCount = 0,
      totalWorkHours = 0,
      attendanceOTHours = 0;

    for (const a of attendances) {
      if (a.status === "holiday" || a.status === "weekend") continue;
      if (a.status === "on_leave") {
        leaveDays++;
        // If salary should be deducted for this leave (unpaid), count as absent
        if (a.leaveDeductSalary !== false) {
          absentCount++;
        } else {
          // Paid leave: count as present with full shift hours
          presentDays++;
          totalWorkHours += shiftHoursPerDay;
        }
        continue;
      }
      if (a.status === "absent") {
        absentCount++;
        continue;
      }

      if (a.status === "half_day") {
        // Credit full shift hours; halfDayDeduction subtracts half below — shown explicitly.
        halfDayCount++;
        presentDays++;
        totalWorkHours += shiftHoursPerDay;
        if (a.overtime && a.overtime > 0) attendanceOTHours += a.overtime;
        continue;
      }

      // Reconstruct IST midnight from the attendance date regardless of whether it
      // was stored as IST midnight (18:30 UTC) or UTC midnight (00:00 UTC).
      const istDate = new Date(new Date(a.date).getTime() + IST_OFFSET_MS);
      const istMidnight =
        Date.UTC(
          istDate.getUTCFullYear(),
          istDate.getUTCMonth(),
          istDate.getUTCDate(),
        ) - IST_OFFSET_MS;
      const shiftStartUTC = new Date(
        istMidnight + (shiftH * 60 + shiftM) * 60_000,
      );
      const shiftEndUTC = new Date(
        istMidnight + (shiftEndH * 60 + shiftEndM) * 60_000,
      );

      if (a.checkIn && a.checkOut) {
        const rawIn = new Date(a.checkIn).getTime();
        const rawOut = new Date(a.checkOut).getTime();
        const shiftEndMs = shiftEndUTC.getTime();

        // Credit from shift start (not actual check-in) so late deduction
        // shows as an explicit line item rather than silently reducing earnedBasic.
        const effectiveFrom = shiftStartUTC.getTime();
        // Regular hours capped at shift end; OT tracked separately below.
        const effectiveOut = Math.min(rawOut, shiftEndMs);
        const fullHours = Math.max(
          0,
          (effectiveOut - effectiveFrom) / 3_600_000,
        );
        totalWorkHours += fullHours;
        presentDays++;

        // Always recalculate OT fresh from actual punch times — never trust the stored
        // a.overtime field (it may be stale from a previous buggy auto-calculation).
        if (otEnabled && rawOut > shiftEndMs) {
          attendanceOTHours += (rawOut - shiftEndMs) / 3_600_000;
        }

        if (a.status === "late") {
          lateCount++;
          // Hours lost = time between shift start and actual check-in
          const hoursLate = Math.max(
            0,
            (rawIn - shiftStartUTC.getTime()) / 3_600_000,
          );
          lateHoursLost += hoursLate;
        }
      } else if (a.checkIn) {
        // Checked in but no checkout — credit full shift hours; track late hours.
        totalWorkHours += shiftHoursPerDay;
        presentDays++;
        if (a.overtime > 0) attendanceOTHours += a.overtime;

        if (a.status === "late") {
          lateCount++;
          const rawIn = new Date(a.checkIn).getTime();
          const hoursLate = Math.max(
            0,
            (rawIn - shiftStartUTC.getTime()) / 3_600_000,
          );
          lateHoursLost += hoursLate;
        }
      } else if (["present", "late"].includes(a.status)) {
        // Manual attendance without punch times — use full shift hours, no late tracking
        totalWorkHours += shiftHoursPerDay;
        presentDays++;
        if (a.status === "late") lateCount++;
        if (a.overtime > 0) attendanceOTHours += a.overtime;
      }
    }

    // Absent deduction: 1 full daily rate per explicitly absent-marked day.
    const absentDeduction = parseFloat((absentCount * dailyRate).toFixed(2));

    // earnedSalary = actual hours earned + absent days credit (inflated so absentDeduction
    // can be shown as an explicit column without changing net salary).
    const hoursEarned = Math.max(
      0,
      parseFloat((totalWorkHours * hourlyRate).toFixed(2)),
    );
    const earnedSalary = parseFloat((hoursEarned + absentDeduction).toFixed(2));

    // Half-day deduction: daily rate × 0.5 per half-day record (credited full hours above).
    const halfDayDeduction = parseFloat(
      (halfDayCount * dailyRate * 0.5).toFixed(2),
    );

    // Late deduction = hours-lost pay + optional rule fine per occurrence.
    let lateDeduction = parseFloat((lateHoursLost * hourlyRate).toFixed(2));
    if (
      deductionRule &&
      lateCount > 0 &&
      deductionRule.lateDeductionAmount > 0
    ) {
      const ruleFine =
        deductionRule.lateDeductionType === "percent"
          ? lateCount * dailyRate * (deductionRule.lateDeductionAmount / 100)
          : lateCount * deductionRule.lateDeductionAmount;
      lateDeduction += parseFloat(ruleFine.toFixed(2));
    }

    const earlyCheckoutDeduction = 0;

    const txMonthStart = new Date(y, m - 1, 1);
    const txMonthEnd = new Date(y, m, 0, 23, 59, 59);
    const pendingTx = await Transaction.find({
      employee: emp._id,
      company: req.user.company,
      status: "pending",
      date: { $gte: txMonthStart, $lte: txMonthEnd },
    });

    let totalAllowances = 0;
    let totalPenalties = 0;
    let totalOT = 0;
    let totalOTHours = 0;
    const txIds = [];
    for (const tx of pendingTx) {
      if (tx.type === "allowance") totalAllowances += tx.amount;
      else if (tx.type === "penalty") totalPenalties += tx.amount;
      else if (tx.type === "overtime") {
        totalOT += tx.amount;
        totalOTHours += tx.hours || 0;
      }
      txIds.push(tx._id);
    }

    const activeLoans = await Loan.find({
      employee: emp._id,
      company: req.user.company,
      status: "active",
    });

    let loanDeduction = 0;
    const loanUpdates = [];

    const shiftHours = shiftTotalMins > 0 ? shiftTotalMins / 60 : 8;
    const otHourlyRate = (dailyRate / shiftHours) * otMultiplier;
    const attendanceOTPay = parseFloat(
      (attendanceOTHours * otHourlyRate).toFixed(2),
    );
    const grossSalary =
      earnedSalary + totalAllowances + totalOT + attendanceOTPay;
    const preDeductions =
      lateDeduction +
      halfDayDeduction +
      absentDeduction +
      earlyCheckoutDeduction +
      totalPenalties;
    let salaryAfterDeductions = Math.max(0, grossSalary - preDeductions);

    for (const loan of activeLoans) {
      if (loan.remainingBalance <= 0) continue;

      const emi = Math.min(
        loan.monthlyEmi || loan.remainingBalance,
        loan.remainingBalance,
        salaryAfterDeductions,
      );
      if (emi <= 0) continue;

      loanDeduction += emi;
      salaryAfterDeductions -= emi;

      const newBalance = Math.max(0, loan.remainingBalance - emi);
      loanUpdates.push({
        id: loan._id,
        newBalance,
        cleared: newBalance === 0,
      });
    }

    const totalDeductions = preDeductions + loanDeduction;
    const netSalary = Math.max(0, grossSalary - totalDeductions);

    payrolls.push({
      company: req.user.company,
      employee: emp._id,
      month: m,
      year: y,
      basicSalary: salary,
      earnedBasic: earnedSalary,
      totalWorkHours: parseFloat(totalWorkHours.toFixed(2)),
      hourlyRate: parseFloat(hourlyRate.toFixed(4)),
      otherAllowances: totalAllowances,
      otPay: attendanceOTPay + totalOT,
      grossSalary,
      lateDeductionAmount: lateDeduction,
      halfDayDeduction: halfDayDeduction,
      absentDays: absentCount,
      absentDeduction: absentDeduction,
      earlyCheckoutDeduction: 0,
      penaltyAmount: totalPenalties,
      loanDeduction,
      otherDeductions: preDeductions,
      totalDeductions,
      netSalary,
      workingDays,
      presentDays,
      leaveDays,
      weeklyOffDays: 0,
      overtimeHours: attendanceOTHours + totalOTHours,
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

    const workDaysPerWeek = emp.workDaysPerWeek ?? 6;
    const workingDays = getWorkingDays(y, m, workDaysPerWeek);
    const salary = emp.salary ?? 0;
    const dailyRate = workingDays > 0 ? salary / workingDays : 0;

    const empShift = getEffectiveShift(emp);
    let shiftH, shiftM, shiftEndH, shiftEndM;
    if (empShift?.startTime) {
      const s = parseTime(empShift.startTime);
      shiftH = s.hour;
      shiftM = s.minute;
    } else {
      shiftH = deductionRule?.shiftStartHour ?? 9;
      shiftM = deductionRule?.shiftStartMinute ?? 0;
    }
    if (empShift?.endTime) {
      const e = parseTime(empShift.endTime);
      shiftEndH = e.hour;
      shiftEndM = e.minute;
    } else {
      shiftEndH = deductionRule?.shiftEndHour ?? 18;
      shiftEndM = deductionRule?.shiftEndMinute ?? 0;
    }

    const otEnabled = emp.otEnabled === true;
    const otMultiplier = emp.otRate && emp.otRate > 0 ? emp.otRate : 1;
    const shiftTotalMins = shiftEndH * 60 + shiftEndM - (shiftH * 60 + shiftM);
    const shiftHoursPerDay = shiftTotalMins > 0 ? shiftTotalMins / 60 : 8;
    const hourlyRate = dailyRate / shiftHoursPerDay;

    let presentDays = 0,
      leaveDays = 0,
      halfDayCount = 0,
      lateCount = 0,
      lateHoursLost = 0,
      absentCount = 0,
      totalWorkHours = 0,
      attendanceOTHours = 0;

    for (const a of attendances) {
      if (a.status === "holiday" || a.status === "weekend") continue;
      if (a.status === "on_leave") {
        leaveDays++;
        if (a.leaveDeductSalary !== false) {
          absentCount++;
        } else {
          presentDays++;
          totalWorkHours += shiftHoursPerDay;
        }
        continue;
      }
      if (a.status === "absent") {
        absentCount++;
        continue;
      }
      if (a.status === "half_day") {
        halfDayCount++;
        presentDays++;
        totalWorkHours += shiftHoursPerDay;
        if (a.overtime > 0) attendanceOTHours += a.overtime;
        continue;
      }
      const istDate = new Date(new Date(a.date).getTime() + IST_OFFSET_MS);
      const istMidnight =
        Date.UTC(
          istDate.getUTCFullYear(),
          istDate.getUTCMonth(),
          istDate.getUTCDate(),
        ) - IST_OFFSET_MS;
      const shiftStartUTC = new Date(
        istMidnight + (shiftH * 60 + shiftM) * 60_000,
      );
      const shiftEndUTC = new Date(
        istMidnight + (shiftEndH * 60 + shiftEndM) * 60_000,
      );

      if (a.checkIn && a.checkOut) {
        const rawIn = new Date(a.checkIn).getTime();
        const rawOut = new Date(a.checkOut).getTime();
        const shiftEndMs = shiftEndUTC.getTime();
        const effectiveFrom = shiftStartUTC.getTime();
        const effectiveOut = Math.min(rawOut, shiftEndMs);
        totalWorkHours += Math.max(
          0,
          (effectiveOut - effectiveFrom) / 3_600_000,
        );
        presentDays++;
        if (otEnabled && rawOut > shiftEndMs)
          attendanceOTHours += (rawOut - shiftEndMs) / 3_600_000;
        if (a.status === "late") {
          lateCount++;
          lateHoursLost += Math.max(
            0,
            (rawIn - shiftStartUTC.getTime()) / 3_600_000,
          );
        }
      } else if (a.checkIn) {
        totalWorkHours += shiftHoursPerDay;
        presentDays++;
        if (a.overtime > 0) attendanceOTHours += a.overtime;
        if (a.status === "late") {
          lateCount++;
          lateHoursLost += Math.max(
            0,
            (new Date(a.checkIn).getTime() - shiftStartUTC.getTime()) /
              3_600_000,
          );
        }
      } else if (["present", "late"].includes(a.status)) {
        totalWorkHours += shiftHoursPerDay;
        presentDays++;
        if (a.status === "late") lateCount++;
        if (a.overtime > 0) attendanceOTHours += a.overtime;
      }
    }

    const absentDeduction = parseFloat((absentCount * dailyRate).toFixed(2));
    const hoursEarned = Math.max(
      0,
      parseFloat((totalWorkHours * hourlyRate).toFixed(2)),
    );
    const earnedSalary = parseFloat((hoursEarned + absentDeduction).toFixed(2));
    const halfDayDeduction = parseFloat(
      (halfDayCount * dailyRate * 0.5).toFixed(2),
    );
    let lateDeduction = parseFloat((lateHoursLost * hourlyRate).toFixed(2));
    if (
      deductionRule &&
      lateCount > 0 &&
      deductionRule.lateDeductionAmount > 0
    ) {
      const ruleFine =
        deductionRule.lateDeductionType === "percent"
          ? lateCount * dailyRate * (deductionRule.lateDeductionAmount / 100)
          : lateCount * deductionRule.lateDeductionAmount;
      lateDeduction += parseFloat(ruleFine.toFixed(2));
    }

    const txMonthStart = new Date(y, m - 1, 1);
    const txMonthEnd = new Date(y, m, 0, 23, 59, 59);
    const pendingTx = await Transaction.find({
      employee: emp._id,
      company: req.user.company,
      status: "pending",
      date: { $gte: txMonthStart, $lte: txMonthEnd },
    });
    let totalAllowances = 0,
      totalPenalties = 0,
      totalOT = 0,
      totalOTHours = 0;
    for (const tx of pendingTx) {
      if (tx.type === "allowance") totalAllowances += tx.amount;
      else if (tx.type === "penalty") totalPenalties += tx.amount;
      else if (tx.type === "overtime") {
        totalOT += tx.amount;
        totalOTHours += tx.hours || 0;
      }
    }

    const activeLoans = await Loan.find({
      employee: emp._id,
      company: req.user.company,
      status: "active",
    });
    let loanDeduction = 0;
    const shiftHours = shiftTotalMins > 0 ? shiftTotalMins / 60 : 8;
    const otHourlyRate = (dailyRate / shiftHours) * otMultiplier;
    const attendanceOTPay = parseFloat(
      (attendanceOTHours * otHourlyRate).toFixed(2),
    );
    const grossSalary =
      earnedSalary + totalAllowances + totalOT + attendanceOTPay;
    const preDeductions =
      lateDeduction + halfDayDeduction + absentDeduction + totalPenalties;
    let salaryAfterDeductions = Math.max(0, grossSalary - preDeductions);
    for (const loan of activeLoans) {
      if (loan.remainingBalance <= 0) continue;
      const emi = Math.min(
        loan.monthlyEmi || loan.remainingBalance,
        loan.remainingBalance,
        salaryAfterDeductions,
      );
      if (emi <= 0) continue;
      loanDeduction += emi;
      salaryAfterDeductions -= emi;
    }
    const totalDeductions = preDeductions + loanDeduction;
    const netSalary = Math.max(0, grossSalary - totalDeductions);
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
      basicSalary: salary,
      earnedBasic: earnedSalary,
      totalWorkHours: parseFloat(totalWorkHours.toFixed(2)),
      hourlyRate: parseFloat(hourlyRate.toFixed(4)),
      otherAllowances: totalAllowances,
      otPay: attendanceOTPay + totalOT,
      grossSalary,
      lateDeductionAmount: lateDeduction,
      halfDayDeduction,
      absentDays: absentCount,
      absentDeduction,
      penaltyAmount: totalPenalties,
      loanDeduction,
      totalDeductions,
      netSalary,
      workingDays,
      presentDays,
      leaveDays,
      overtimeHours: parseFloat((attendanceOTHours + totalOTHours).toFixed(2)),
      alreadyProcessed,
    });
  }

  res.json({ success: true, data: previews });
});

const markSlipReceived = asyncHandler(async (req, res) => {
  const { status } = req.body; // "received" | "not_received"
  console.log(
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
    console.warn(
      `[Payroll] markSlipReceived → payroll ${req.params.id} not found`,
    );
    res.status(404);
    throw new Error("Payroll not found");
  }
  payroll.slipReceived = status;
  payroll.slipReceivedAt = new Date();
  payroll.slipReceivedBy = req.user._id;
  await payroll.save();
  console.log(
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
