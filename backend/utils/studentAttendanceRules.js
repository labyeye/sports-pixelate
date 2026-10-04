const StudentAttendance = require("../models/StudentAttendance");
const StudentSubscription = require("../models/StudentSubscription");
const DeductionRule = require("../models/DeductionRule");

// The owner's automatic-marking switches (Attendance Settings). Everything is
// off unless the owner turned it on, so a company with no settings only ever
// gets manual marks.
async function getAutoMarkingRules(companyId) {
  const rule = await DeductionRule.findOne({ company: companyId })
    .select(
      "studentAutoLateEnabled studentLateGraceMinutes studentAutoAbsentEnabled studentAbsentAfterEndMinutes",
    )
    .lean();
  return {
    autoLate: Boolean(rule?.studentAutoLateEnabled),
    lateGraceMinutes: rule?.studentLateGraceMinutes ?? 15,
    autoAbsent: Boolean(rule?.studentAutoAbsentEnabled),
    absentAfterEndMinutes: rule?.studentAbsentAfterEndMinutes ?? 30,
  };
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};

const istShift = (date) => new Date(new Date(date).getTime() + IST_OFFSET_MS);

// Prefers an "active" (paid) subscription over a "pending_renewal" one, same
// as studentController.attachActivePlans.
async function activePlanFor(studentId) {
  const subs = await StudentSubscription.find({
    student: studentId,
    status: { $in: ["active", "pending_renewal"] },
  }).populate("plan", "name scheduleType scheduleDays startTime endTime");
  const best = subs.find((s) => s.status === "active") || subs[0];
  return best?.plan || null;
}

// Decides whether a "present" mark is really "late" (only when the owner
// enabled auto-late, using their grace minutes). `dateOnly` is the
// attendance day (UTC midnight, see utils/dateOnly) and `markedAt` the moment
// the student arrived (check-in time, or now). Only converts when the arrival
// is on that same IST calendar day, so back-filling an old date stays present,
// and never overrides a record a coach already settled (present/late/excused).
async function resolvePresentStatus(companyId, studentId, dateOnly, markedAt) {
  if (!markedAt) return "present";
  const rules = await getAutoMarkingRules(companyId);
  if (!rules.autoLate) return "present";

  const existing = await StudentAttendance.findOne({
    student: studentId,
    date: dateOnly,
  }).select("status");
  if (existing && existing.status !== "absent") return "present";

  const plan = await activePlanFor(studentId);
  if (!plan?.startTime) return "present";

  const ist = istShift(markedAt);
  const sameDay =
    ist.getUTCFullYear() === dateOnly.getUTCFullYear() &&
    ist.getUTCMonth() === dateOnly.getUTCMonth() &&
    ist.getUTCDate() === dateOnly.getUTCDate();
  if (!sameDay) return "present";

  const arrived = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return arrived - toMinutes(plan.startTime) > rules.lateGraceMinutes
    ? "late"
    : "present";
}

// Is the plan expected on this weekday? Mirrors the apps' isSessionDay.
function isScheduledOn(plan, dateOnly) {
  if (!plan || plan.scheduleType !== "custom_days") return true;
  return (plan.scheduleDays || []).includes(
    WEEKDAY_KEYS[dateOnly.getUTCDay()],
  );
}

module.exports = {
  getAutoMarkingRules,
  resolvePresentStatus,
  isScheduledOn,
  toMinutes,
  IST_OFFSET_MS,
};
