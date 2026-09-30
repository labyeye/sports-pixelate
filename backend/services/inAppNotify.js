const Notification = require("../models/Notification");
const User = require("../models/User");
const Subscription = require("../models/Subscription");

// In-app notifications are the baseline paid feature (₹30/user/month tier);
// WhatsApp is an additional ₹50/user/month tier on top. Callers use this to
// decide whether to ALSO send a WhatsApp message alongside the in-app one.
async function companyAllowsWhatsapp(companyId) {
  const sub = await Subscription.findOne({ company: companyId }).select(
    "wantsWhatsapp status",
  );
  return !!(sub && sub.wantsWhatsapp && sub.status !== "cancelled");
}

// Writes one Notification doc per recipient user id. Never throws — a
// notification failure must not break the attendance-marking request.
async function notifyUsers(companyId, userIds, payload) {
  const ids = [...new Set(userIds.map(String))].filter(Boolean);
  if (ids.length === 0) return;
  try {
    await Notification.insertMany(
      ids.map((recipient) => ({
        company: companyId,
        recipient,
        type: payload.type || "general",
        title: payload.title,
        message: payload.message,
        student: payload.student,
        employee: payload.employee,
      })),
    );
  } catch (err) {
    console.error("[inAppNotify] notifyUsers error:", err.message);
  }
}

// The owners/HR of a company — same role pair used everywhere else in this
// codebase to mean "the owner" (there is no literal role: "owner").
async function notifyOwners(companyId, payload) {
  try {
    const owners = await User.find({
      company: companyId,
      role: { $in: ["super_admin", "hr_manager"] },
    }).select("_id");
    await notifyUsers(companyId, owners.map((u) => u._id), payload);
  } catch (err) {
    console.error("[inAppNotify] notifyOwners error:", err.message);
  }
}

// Every parent User account linked to this student (guardians who supplied
// an email+password get a User doc via ensureParentAccounts; guardians who
// only gave a phone number have none and can only be reached via WhatsApp).
async function notifyParentsOfStudent(studentId, companyId, payload) {
  try {
    const parents = await User.find({
      company: companyId,
      role: "parent",
      children: studentId,
    }).select("_id");
    await notifyUsers(companyId, parents.map((u) => u._id), payload);
  } catch (err) {
    console.error("[inAppNotify] notifyParentsOfStudent error:", err.message);
  }
}

module.exports = {
  companyAllowsWhatsapp,
  notifyUsers,
  notifyOwners,
  notifyParentsOfStudent,
};
