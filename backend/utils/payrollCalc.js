// Pure payroll calculation shared by previewPayroll (dry run) and
// processPayroll (saves) so both always produce the same figures.
// No database access here: callers load the attendance, pending transactions
// and active loans and pass them in.
const { getEffectiveShift } = require("./shiftUtils");

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

// Number of paid working days in a month for a given work-week length:
// 7 = every day, 6 = Mon-Sat, anything else = Mon-Fri. Used as the divisor
// when turning monthly salary into a daily rate. Never returns 0.
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

// "HH:MM" -> { hour, minute }; blank/invalid input falls back to 00:00.
function parseTime(timeStr) {
  const [h, m] = (timeStr || "00:00").split(":").map(Number);
  return { hour: h || 0, minute: m || 0 };
}

/**
 * Calculates one employee's payroll for a month.
 *
 *   dailyRate  = monthly salary / working days
 *   hourlyRate = dailyRate / shift hours
 *   earned     = hours worked (from shift start, capped at shift end) x hourlyRate
 * Adds overtime and allowances, subtracts absent, half-day and late deductions,
 * penalties and active-loan EMIs. Shift times are IST.
 *
 * @param {object} p
 * @param {object} p.emp            Employee (with `shift` populated)
 * @param {object[]} p.attendances  The employee's attendance rows for the month
 * @param {number} p.year
 * @param {number} p.month          1-12
 * @param {object|null} p.deductionRule  Company late-fine / default-shift rule
 * @param {object[]} p.pendingTx    Pending allowance / penalty / overtime transactions
 * @param {object[]} p.activeLoans  Active loans (EMIs are taken in order)
 * @returns {{ record: object, loanUpdates: object[], txIds: any[] }}
 *   `record` holds the figures; `loanUpdates` and `txIds` are what the caller
 *   must persist when actually processing (a preview ignores them).
 */
function computeEmployeePayroll({
  emp,
  attendances,
  year: y,
  month: m,
  deductionRule,
  pendingTx,
  activeLoans,
}) {
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

  return {
    record: {
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
      earlyCheckoutDeduction,
      penaltyAmount: totalPenalties,
      loanDeduction,
      otherDeductions: preDeductions,
      totalDeductions,
      netSalary,
      workingDays,
      presentDays,
      leaveDays,
      overtimeHoursRaw: attendanceOTHours + totalOTHours,
    },
    loanUpdates,
    txIds,
  };
}

module.exports = { computeEmployeePayroll, getWorkingDays, parseTime, IST_OFFSET_MS };
