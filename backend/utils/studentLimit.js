const Student = require("../models/Student");
const Subscription = require("../models/Subscription");

// Plan limit: the academy's paid plan allows `maxStudents` active students (Starter 50, Growth 100, Unlimited).
// Throws a 403 with a message the owner can act on; call it before creating students.
async function assertStudentSlot(companyId, res, adding = 1) {
  const sub = await Subscription.findOne({ company: companyId }).select(
    "maxStudents planId",
  );
  if (!sub || !sub.maxStudents) return; // no limit recorded (legacy / custom deals)
  const active = await Student.countDocuments({
    company: companyId,
    status: "active",
  });
  if (active + adding > sub.maxStudents) {
    res.status(403);
    throw new Error(
      `Student limit reached (${active}/${sub.maxStudents}) on your plan. Upgrade your plan in Billing to add more students.`,
    );
  }
}

// Highest STU number already used by this academy. Counting students would reuse an id after a delete and
// collide with the unique (studentId, company) index.
async function lastStudentNumber(companyId) {
  const last = await Student.findOne({ company: companyId })
    .sort({ studentId: -1 })
    .select("studentId")
    .lean();
  return last ? parseInt(String(last.studentId).replace(/\D/g, ""), 10) || 0 : 0;
}

module.exports = { assertStudentSlot, lastStudentNumber };
