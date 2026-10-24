const User = require("../models/User");
const Session = require("../models/Session");
const AuditLog = require("../models/AuditLog");
const Subscription = require("../models/Subscription");
const generateToken = require("./generateToken");
const { getCompanyFeatures } = require("./planFeatures");

const COMPANY_POPULATE = {
  path: "company",
  select: "name email phone status subscription website",
  populate: {
    path: "subscription",
    select:
      "status plan paymentStatus billingCycle monthlyPrice yearlyPrice maxStudents currentStudentCount renewalDate isTrial trialEndDate",
  },
};

// Loads a user the way login does (company + subscription populated).
const findForSignIn = (query, select = "") => {
  const q = User.findOne(query);
  if (select) q.select(select);
  return q.populate(COMPANY_POPULATE);
};

function describeFromUserAgent(ua = "") {
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "";
  return [browser, os && `on ${os}`].filter(Boolean).join(" ") || "Web browser";
}

// Creates the device record for a fresh sign-in and returns its id for the token.
async function startSession(req, user) {
  const platform = String(req.headers["x-device-platform"] || "web").slice(
    0,
    20,
  );
  const deviceName =
    String(req.headers["x-device-name"] || "")
      .trim()
      .slice(0, 80) || describeFromUserAgent(req.headers["user-agent"]);
  const s = await Session.create({
    userId: user._id,
    deviceName,
    platform,
    ip: req.ip || "",
  });
  // Login trail for the Audit Log (kept after the session row is deleted on logout).
  AuditLog.create({
    company: user.company?._id || user.company,
    user: user._id,
    userEmail: user.email,
    userName: user.name,
    action: "auth.login",
    entity: "Session",
    entityId: s._id,
    details: { device: deviceName, platform, sessionId: String(s._id) },
    ip: req.ip || "",
  }).catch(() => {});
  return String(s._id);
}

// Same gates the password login applies: active user, live subscription, trial,
// and the mobile-app plan feature. Throws via res.status() like the controllers.
async function assertSignInAllowed(req, res, user) {
  if (user.status === "inactive") {
    res.status(403);
    throw new Error("Your account has been deactivated. Please contact HR.");
  }
  if (user.company && user.role !== "super_admin") {
    const subscription = await Subscription.findOne({
      company: user.company._id,
      status: { $in: ["active", "pending_renewal"] },
    });
    if (!subscription || subscription.paymentStatus !== "completed") {
      res.status(403);
      throw new Error(
        "No active subscription. Please contact your administrator.",
      );
    }
    if (
      subscription.isTrial &&
      subscription.trialEndDate &&
      subscription.trialEndDate < new Date()
    ) {
      res.status(403);
      throw new Error(
        "Your 2-month free trial has expired. Please subscribe to continue.",
      );
    }
  }
  if (req.body?.client === "mobile" && user.company) {
    const features = await getCompanyFeatures(user.company._id);
    if (!features.mobileApp) {
      res.status(403);
      throw new Error(
        "Your organization's plan does not include mobile app access.",
      );
    }
  }
}

// What every successful sign-in returns. Includes the verification flags so the
// app shows the right status right after login.
function signInPayload(user, sid, { viaOtp = false } = {}) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    phone: user.phone,
    status: user.status,
    department: user.department,
    company: user.company,
    emailVerified: !!user.emailVerified,
    phoneVerified: !!user.phoneVerified,
    twoFactorEnabled: !!user.twoFactorEnabled,
    token: generateToken(
      user._id,
      { sid, ...(viaOtp && { otp: true }) },
      user.tokenVersion,
    ),
  };
}

// Clears the wrong-password lock, records the login, opens a device session
// and sends the response.
async function completeSignIn(req, res, user, opts) {
  user.failedLogins = 0;
  user.lockUntil = undefined;
  user.lastLogin = new Date();
  await user.save();
  const sid = await startSession(req, user);
  res.json({ success: true, data: signInPayload(user, sid, opts) });
}

module.exports = {
  findForSignIn,
  startSession,
  assertSignInAllowed,
  signInPayload,
  completeSignIn,
};
