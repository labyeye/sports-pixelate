const Notification = require("../models/Notification");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Subscription = require("../models/Subscription");
const { notifyUsers: pushToUsers } = require("./pushNotificationService");

// In-app notifications come with every plan. WhatsApp is paid per message from prepaid credits (or, for
// academies on the old per-user WhatsApp tier, by that tier). Callers use this to decide whether to ALSO send a
// WhatsApp message alongside the in-app one; the credit charge itself happens when the message is sent.
async function companyAllowsWhatsapp(companyId) {
  const sub = await Subscription.findOne({ company: companyId }).select(
    "wantsWhatsapp status",
  );
  if (!sub || sub.status === "cancelled") return false;
  return (
    !!sub.wantsWhatsapp || (await require("./creditsService").isMetered(companyId))
  );
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
    return;
  }
  // Also push to the users' phones / browsers (FCM + web push). Fire-and-forget:
  // pushToUsers never throws and must not delay the request that triggered it.
  pushToUsers(ids, {
    title: payload.title,
    body: payload.message,
    data: { type: payload.type || "general", screen: "Notifications" },
  });
}

// The owners/HR of a company — same role pair used everywhere else in this
// codebase to mean "the owner" (there is no literal role: "owner").
async function notifyOwners(companyId, payload) {
  try {
    const owners = await User.find({
      company: companyId,
      role: { $in: ["super_admin", "hr_manager"] },
    }).select("_id");
    await notifyUsers(
      companyId,
      owners.map((u) => u._id),
      payload,
    );
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
    await notifyUsers(
      companyId,
      parents.map((u) => u._id),
      payload,
    );
  } catch (err) {
    console.error("[inAppNotify] notifyParentsOfStudent error:", err.message);
  }
}

// Notifies one employee through their linked User account. `employee` may be a populated doc,
// a lean object or just { _id } — the User link is looked up when it isn't on it.
async function notifyEmployee(companyId, employee, payload) {
  try {
    let userId = employee?.user?._id || employee?.user;
    if (!userId && employee?._id) {
      const e = await Employee.findById(employee._id).select("user").lean();
      userId = e?.user;
    }
    if (!userId) return;
    await notifyUsers(companyId, [userId], {
      ...payload,
      employee: payload.employee || employee._id,
    });
  } catch (err) {
    console.error("[inAppNotify] notifyEmployee error:", err.message);
  }
}

module.exports = {
  companyAllowsWhatsapp,
  notifyEmployee,
  notifyUsers,
  notifyOwners,
  notifyParentsOfStudent,
};
