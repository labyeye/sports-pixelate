const cron = require("node-cron");
const { withJobLock } = require("../utils/jobLock");
const StudentAttendance = require("../models/StudentAttendance");
const StudentSubscription = require("../models/StudentSubscription");
const { isHolidayDate } = require("../controllers/holidayController");
const {
  getAutoMarkingRules,
  isScheduledOn,
  toMinutes,
  IST_OFFSET_MS,
} = require("../utils/studentAttendanceRules");
const { notifyParentsOfStudent } = require("../services/inAppNotify");
const logger = require("../utils/logger");

// Plans without an end time are closed out at this IST time.
const DEFAULT_CUTOFF_MIN = 22 * 60;

async function processDay(dateOnly, nowMinutes, isToday) {
  const subs = await StudentSubscription.find({
    status: { $in: ["active", "pending_renewal"] },
  })
    .populate("plan", "scheduleType scheduleDays startTime endTime")
    .populate("student", "company batch status enrollmentDate firstName lastName")
    .lean();

  // One plan per student, preferring the paid ("active") subscription.
  const byStudent = new Map();
  for (const sub of subs) {
    if (!sub.student || !sub.plan) continue;
    const key = String(sub.student._id);
    if (!byStudent.has(key) || sub.status === "active") byStudent.set(key, sub);
  }

  const holidayCache = new Map();
  const rulesCache = new Map();
  const ops = [];
  const meta = [];
  for (const { student, plan } of byStudent.values()) {
    if (student.status && student.status !== "active") continue;
    if (student.enrollmentDate && new Date(student.enrollmentDate) > new Date(dateOnly.getTime() + 24 * 3600 * 1000))
      continue;
    if (!isScheduledOn(plan, dateOnly)) continue;

    const cid = String(student.company);
    if (!rulesCache.has(cid)) {
      rulesCache.set(cid, await getAutoMarkingRules(cid));
    }
    const rules = rulesCache.get(cid);
    if (!rules.autoAbsent) continue;

    const cutoff = plan.endTime
      ? toMinutes(plan.endTime) + rules.absentAfterEndMinutes
      : DEFAULT_CUTOFF_MIN;
    if (isToday && nowMinutes < cutoff) continue;

    if (!holidayCache.has(cid)) {
      holidayCache.set(cid, !!(await isHolidayDate(cid, dateOnly)));
    }
    if (holidayCache.get(cid)) continue;

    ops.push({
      updateOne: {
        filter: { student: student._id, date: dateOnly },
        // Insert-only: never touches a day a coach (or device) already marked.
        update: {
          $setOnInsert: {
            company: student.company,
            status: "absent",
            batch: student.batch || "",
            verifyMode: "auto",
            markedBy: null,
          },
        },
        upsert: true,
      },
    });
    meta.push(student);
  }
  if (!ops.length) return 0;

  const res = await StudentAttendance.bulkWrite(ops, { ordered: false });
  const created = res.upsertedIds || {};
  for (const idx of Object.keys(created)) {
    const st = meta[Number(idx)];
    notifyParentsOfStudent(st._id, st.company, {
      type: "student_attendance",
      title: "Student attendance marked",
      message: `${`${st.firstName} ${st.lastName}`.trim()} was marked absent today.`,
      student: st._id,
    }).catch(() => {});
  }
  return Object.keys(created).length;
}

// Marks every scheduled-but-unmarked student absent once their session is
// over. Looks at yesterday too, so a restart or missed tick doesn't leave a gap.
async function runStudentAutoAbsent() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const today = new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()),
  );
  const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
  const nowMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();

  const a = await processDay(yesterday, nowMinutes, false);
  const b = await processDay(today, nowMinutes, true);
  if (a + b) logger.info(`[StudentAutoAbsent] marked ${a + b} absent`);
}

function startStudentAutoAbsentJob() {
  cron.schedule(
    "*/15 * * * *",
    () =>
      withJobLock("student-auto-absent", 10 * 60 * 1000, runStudentAutoAbsent).catch(
        (err) => {
          console.error("[StudentAutoAbsent] failed:", err);
          require("../utils/monitoring").captureError(err, {
            job: "student-auto-absent",
          });
        },
      ),
    { timezone: "UTC" },
  );
  logger.info("[StudentAutoAbsent] Scheduled (every 15 minutes)");
}

module.exports = { startStudentAutoAbsentJob, runStudentAutoAbsent };
