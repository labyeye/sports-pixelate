const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const Shift = require("../models/Shift");
const Leave = require("../models/Leave");
const { isHolidayDate } = require("../controllers/holidayController");

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function nowIST() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function toISTMidnight(istDate) {
  return new Date(
    Date.UTC(
      istDate.getUTCFullYear(),
      istDate.getUTCMonth(),
      istDate.getUTCDate(),
    ),
  );
}

function shiftEndMinutes(shift) {
  const [h, m] = shift.endTime.split(":").map(Number);
  return h * 60 + m;
}

function shiftStartMinutes(shift) {
  const [h, m] = shift.startTime.split(":").map(Number);
  return h * 60 + m;
}

// Get check-in time as minutes from midnight (IST)
function checkInMinutes(checkInDate) {
  const ist = new Date(checkInDate.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

async function processDate(targetDate, istMinutesNow) {
  const istNow = nowIST();
  const todayMidnight = toISTMidnight(istNow);
  const isToday = targetDate.getTime() === todayMidnight.getTime();

  const employees = await Employee.find({
    $or: [{ shift: { $exists: true, $ne: null } }, { isCustomShift: true }],
    $and: [
      {
        $or: [
          { status: "active" },
          { status: { $exists: false } },
          { status: null },
        ],
      },
    ],
  })
    .select(
      "_id company shift isCustomShift customShift otEnabled workScheduleType customWorkDays workDaysPerWeek joinDate exitDate",
    )
    .lean();

  if (!employees.length) return;

  const shiftIds = [
    ...new Set(employees.map((e) => e.shift?.toString()).filter(Boolean)),
  ];
  const shifts = await Shift.find({ _id: { $in: shiftIds } }).lean();
  const shiftMap = Object.fromEntries(shifts.map((s) => [s._id.toString(), s]));

  const byCompany = {};
  for (const emp of employees) {
    const cid = emp.company?.toString();
    if (!cid) continue;
    if (!byCompany[cid]) byCompany[cid] = [];
    byCompany[cid].push(emp);
  }

  for (const [companyId, companyEmps] of Object.entries(byCompany)) {
    const isHoliday = await isHolidayDate(companyId, targetDate);
    if (isHoliday) continue;

    for (const emp of companyEmps) {
      // Skip days outside the employee's employment period entirely.
      if (emp.joinDate) {
        const jd = toISTMidnight(
          new Date(new Date(emp.joinDate).getTime() + IST_OFFSET_MS),
        );
        if (targetDate.getTime() < jd.getTime()) continue;
      }
      if (emp.exitDate) {
        const ed = toISTMidnight(
          new Date(new Date(emp.exitDate).getTime() + IST_OFFSET_MS),
        );
        if (targetDate.getTime() > ed.getTime()) continue;
      }

      const shift =
        emp.isCustomShift &&
        emp.customShift?.startTime &&
        emp.customShift?.endTime
          ? emp.customShift
          : shiftMap[emp.shift?.toString()];
      if (!shift) continue;

      const startMins = shiftStartMinutes(shift);
      const endMins = shiftEndMinutes(shift);
      const cutoffMins = endMins + 60; // 1 hour after shift end

      // For custom schedule employees: only process on their selected working days
      if (emp.workScheduleType === "custom") {
        const targetDayOfWeek = targetDate.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
        const workingDays = emp.customWorkDays || [];
        if (!workingDays.includes(targetDayOfWeek)) continue; // not a working day for this employee
      } else {
        // Standard schedule: skip weekends based on workDaysPerWeek
        const targetDayOfWeek = targetDate.getUTCDay();
        const days = emp.workDaysPerWeek || 6;
        // 5 days = Mon-Fri (skip Sat=6, Sun=0), 6 days = Mon-Sat (skip Sun=0), 7 = all
        if (days === 5 && (targetDayOfWeek === 0 || targetDayOfWeek === 6))
          continue;
        if (days === 6 && targetDayOfWeek === 0) continue;
      }

      // For today: skip if we haven't reached 1 hour past shift end yet
      if (isToday && istMinutesNow < cutoffMins) continue;

      const existing = await Attendance.findOne({
        employee: emp._id,
        date: targetDate,
      });

      // ── Case 1: No check-in at all → check leave, then mark Absent ────────
      if (!existing || !existing.checkIn) {
        // Don't overwrite an already-correct on_leave/holiday/weekend record
        if (
          existing &&
          ["on_leave", "holiday", "weekend"].includes(existing.status)
        ) {
          continue;
        }

        // Check if employee has an approved leave covering this date
        const approvedLeave = await Leave.findOne({
          employee: emp._id,
          status: "approved",
          startDate: { $lte: targetDate },
          endDate: { $gte: targetDate },
        })
          .select("leaveType deductSalary")
          .lean();

        const newStatus = approvedLeave ? "on_leave" : "absent";

        if (existing) {
          if (existing.status !== newStatus) {
            existing.status = newStatus;
            existing.workHours = 0;
            if (approvedLeave)
              existing.leaveDeductSalary = approvedLeave.deductSalary !== false;
            await existing.save();
            console.log(
              `[AutoMark] Marked ${newStatus} (updated): ${emp._id} for ${targetDate.toISOString().slice(0, 10)}`,
            );
          }
        } else {
          await Attendance.create({
            employee: emp._id,
            date: targetDate,
            status: newStatus,
            workHours: 0,
            verifyMode: "auto",
            ...(approvedLeave
              ? { leaveDeductSalary: approvedLeave.deductSalary !== false }
              : {}),
          });
          console.log(
            `[AutoMark] Marked ${newStatus}: ${emp._id} for ${targetDate.toISOString().slice(0, 10)}`,
          );
        }
        continue;
      }

      // ── Case 2: Has check-in but no check-out ───────────────────────────
      if (existing.checkIn && !existing.checkOut) {
        // If overtime is enabled for this employee, skip — they may be working late
        if (emp.otEnabled) {
          console.log(
            `[AutoMark] Skipping no-checkout for ${emp._id}: OT enabled`,
          );
          continue;
        }

        if (
          !["on_leave", "holiday", "weekend", "absent"].includes(
            existing.status,
          )
        ) {
          existing.status = "half_day";
          await existing.save();
          console.log(
            `[AutoMark] Marked half_day (no checkout): ${emp._id} for ${targetDate.toISOString().slice(0, 10)}`,
          );
        }
        continue;
      }

      // ── Case 3: Has both check-in and check-out ─────────────────────────
      // If check-in was more than 2 hours late → half day
      // Also auto-calculate OT hours if employee has OT enabled
      if (existing.checkIn && existing.checkOut) {
        const cinMins = checkInMinutes(existing.checkIn);
        const lateThreshold = startMins + 120; // 2 hours after shift start
        let changed = false;

        if (
          cinMins > lateThreshold &&
          ["present", "late"].includes(existing.status)
        ) {
          existing.status = "half_day";
          changed = true;
          console.log(
            `[AutoMark] Marked half_day (late check-in): ${emp._id} for ${targetDate.toISOString().slice(0, 10)}`,
          );
        }

        // Auto-calculate OT hours: checkout time beyond shift end
        if (emp.otEnabled && shift.endTime) {
          const endMins = shiftEndMinutes(shift);
          const coIST = new Date(existing.checkOut.getTime() + IST_OFFSET_MS);
          const coMins = coIST.getUTCHours() * 60 + coIST.getUTCMinutes();
          if (coMins > endMins) {
            const autoOT = parseFloat(((coMins - endMins) / 60).toFixed(2));
            // Only update if meaningfully different from stored value
            if (Math.abs((existing.overtime || 0) - autoOT) >= 0.01) {
              existing.overtime = autoOT;
              changed = true;
            }
          }
        }

        if (changed) await existing.save();
      }
    }
  }
}

async function runAutoMark() {
  console.log("[AutoMark] Running attendance auto-mark job...");

  const istNow = nowIST();
  const istMinutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();

  // Always process yesterday (day is fully over, no time restriction)
  const yesterdayIST = new Date(istNow);
  yesterdayIST.setUTCDate(yesterdayIST.getUTCDate() - 1);
  const yesterdayDate = toISTMidnight(yesterdayIST);

  const todayDate = toISTMidnight(istNow);

  console.log(
    `[AutoMark] Processing yesterday: ${yesterdayDate.toISOString().slice(0, 10)}`,
  );
  await processDate(yesterdayDate, 1440);

  console.log(
    `[AutoMark] Processing today: ${todayDate.toISOString().slice(0, 10)}`,
  );
  await processDate(todayDate, istMinutes);

  console.log("[AutoMark] Done.");
}

function startAttendanceAutoMarkJob() {
  // Run every hour — if server restarts, next tick catches missed days
  cron.schedule("0 * * * *", runAutoMark, { timezone: "UTC" });
  console.log(
    "[AutoMark] Scheduled attendance auto-mark job (runs every hour)",
  );

  // Run once on startup to catch anything missed while server was down
  runAutoMark().catch((err) =>
    console.error("[AutoMark] Startup run failed:", err),
  );
}

module.exports = { startAttendanceAutoMarkJob, runAutoMark };
