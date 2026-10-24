const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Session = require("../models/Session");
const { logAudit } = require("../utils/auditLogger");
const { sendOtpEmail } = require("../services/notificationService");
const {
  findForSignIn,
  assertSignInAllowed,
  completeSignIn,
} = require("../utils/signIn");
const {
  generateOtp,
  hashOtp,
  checkOtp,
  isEmail,
  STRONG_PASSWORD_RE,
  STRONG_PASSWORD_MSG,
} = require("./authController");

// ── Signed-in devices ────────────────────────────────────────────────────

const listSessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({ userId: req.user._id }).sort({
    lastActiveAt: -1,
  });
  res.json({
    success: true,
    data: sessions.map((s) => ({
      _id: s._id,
      deviceName: s.deviceName,
      platform: s.platform,
      ip: s.ip,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      current: String(s._id) === req.sessionId,
    })),
  });
});

const removeSession = asyncHandler(async (req, res) => {
  const gone = await Session.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!gone) {
    res.status(404);
    throw new Error("Device not found");
  }
  logAudit(req, "auth.logout", "Session", gone._id, {
    device: gone.deviceName,
    platform: gone.platform,
    sessionId: String(gone._id),
    current: String(gone._id) === req.sessionId,
  });
  res.json({ success: true, message: "Device signed out" });
});

const removeOtherSessions = asyncHandler(async (req, res) => {
  await Session.deleteMany(
    req.sessionId
      ? { userId: req.user._id, _id: { $ne: req.sessionId } }
      : { userId: req.user._id },
  );
  res.json({ success: true, message: "Signed out of all other devices" });
});

// ── "Keep me signed in" devices (skip the authenticator code) ────────────

const listTrustedDevices = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+trustedDevices");
  res.json({
    success: true,
    data: user.trustedDevices
      .filter((d) => d.expiresAt > new Date())
      .map((d) => ({
        _id: d._id,
        name: d.name,
        createdAt: d.createdAt,
        lastUsedAt: d.lastUsedAt || null,
        expiresAt: d.expiresAt,
      })),
  });
});

// Forgets the given trusted device (or all of them): the next password login there asks for the code again.
const removeTrustedDevices = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+trustedDevices");
  user.trustedDevices = req.params.id
    ? user.trustedDevices.filter((d) => String(d._id) !== req.params.id)
    : [];
  await user.save();
  res.json({ success: true, message: "Trusted devices updated" });
});

// ── Password reset finish (shared by backup code + passkey) ──────────────

function assertNewPassword(res, password) {
  if (typeof password !== "string" || !STRONG_PASSWORD_RE.test(password)) {
    res.status(400);
    throw new Error(STRONG_PASSWORD_MSG);
  }
}

// Saving a new password bumps tokenVersion (User pre-save), retiring every old token.
async function finishPasswordReset(res, user, password) {
  user.password = password;
  user.failedLogins = 0;
  user.lockUntil = undefined;
  await user.save();
  await Session.deleteMany({ userId: user._id });
  res.json({
    success: true,
    message: "Password reset successful. You can now log in.",
  });
}

// ── Backup codes ─────────────────────────────────────────────────────────

const CODE_COUNT = 10;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const hashCode = (c) =>
  crypto
    .createHash("sha256")
    .update(
      String(c)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ""),
    )
    .digest("hex");
const newCode = () => {
  let out = "";
  for (let i = 0; i < 10; i++)
    out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
};

const backupCodesStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "+backupCodes backupCodesGeneratedAt",
  );
  res.json({
    success: true,
    data: {
      remaining: user.backupCodes.filter((c) => !c.usedAt).length,
      generatedAt: user.backupCodesGeneratedAt || null,
    },
  });
});

// Replaces any existing set. Needs the account password so a stolen session
// alone can't mint recovery codes.
const generateBackupCodes = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const user = await User.findById(req.user._id);
  if (typeof password !== "string" || !(await user.matchPassword(password))) {
    res.status(400);
    throw new Error("Password is incorrect");
  }
  const codes = Array.from({ length: CODE_COUNT }, newCode);
  user.backupCodes = codes.map((c) => ({ hash: hashCode(c) }));
  user.backupCodesGeneratedAt = new Date();
  await user.save();
  res.json({ success: true, data: { codes } });
});

// Single-use sign-in when the user has lost their other methods.
const loginWithBackupCode = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const bad = () => {
    res.status(401);
    throw new Error("Invalid email or backup code");
  };
  if (!isEmail(email) || typeof code !== "string") return bad();

  const user = await findForSignIn(
    { email: email.toLowerCase().trim() },
    "+backupCodes",
  );
  if (!user) return bad();
  const h = hashCode(code);
  const entry = user.backupCodes.find((c) => c.hash === h && !c.usedAt);
  if (!entry) return bad();

  await assertSignInAllowed(req, res, user);
  entry.usedAt = new Date();
  await completeSignIn(req, res, user);
});

const resetPasswordWithBackupCode = asyncHandler(async (req, res) => {
  const { email, code, password } = req.body;
  assertNewPassword(res, password);
  const bad = () => {
    res.status(400);
    throw new Error("Invalid email or backup code");
  };
  if (!isEmail(email) || typeof code !== "string") return bad();

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+backupCodes",
  );
  if (!user) return bad();
  const h = hashCode(code);
  const entry = user.backupCodes.find((c) => c.hash === h && !c.usedAt);
  if (!entry) return bad();
  entry.usedAt = new Date();
  await finishPasswordReset(res, user, password);
});

// ── Email OTP sign-in ────────────────────────────────────────────────────

const loginRequestEmailOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!isEmail(email)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (user && user.status !== "inactive") {
    const otp = generateOtp();
    user.emailLoginOtp = hashOtp(otp);
    user.emailLoginOtpTries = 0;
    user.emailLoginOtpExpire = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    try {
      await sendOtpEmail({
        to: user.email,
        name: user.name,
        otp,
        purpose: "login",
      });
    } catch {
      // logged inside sendOtpEmail; same response either way so it can't be probed
    }
  } else {
    console.warn(
      "[Email OTP] login code requested but no active user with that email — nothing sent",
    );
  }
  res.json({
    success: true,
    message: "If that email is registered, a code has been sent to it.",
  });
});

const loginVerifyEmailOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const bad = () => {
    res.status(401);
    throw new Error("Invalid or expired code");
  };
  if (!isEmail(email) || !otp) return bad();

  const user = await findForSignIn(
    { email: email.toLowerCase().trim() },
    "+emailLoginOtp +emailLoginOtpExpire +emailLoginOtpTries",
  );
  if (
    !user ||
    !(await checkOtp(user, otp, {
      hashField: "emailLoginOtp",
      expireField: "emailLoginOtpExpire",
      triesField: "emailLoginOtpTries",
    }))
  )
    return bad();

  await assertSignInAllowed(req, res, user);
  user.emailLoginOtp = undefined;
  user.emailLoginOtpExpire = undefined;
  user.emailLoginOtpTries = 0;
  await completeSignIn(req, res, user);
});

// ── Email verification / change ──────────────────────────────────────────
// The code goes to the address being verified, proving the user owns it.

const sendEmailVerifyOtp = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "")
    .toLowerCase()
    .trim();
  if (!isEmail(email)) {
    res.status(400);
    throw new Error("Enter a valid email address");
  }
  const user = await User.findById(req.user._id);
  if (email === user.email && user.emailVerified) {
    res.status(400);
    throw new Error("This email is already verified");
  }
  if (
    email !== user.email &&
    (await User.findOne({ email, _id: { $ne: user._id } }))
  ) {
    res.status(400);
    throw new Error("This email is already in use");
  }

  const otp = generateOtp();
  user.pendingEmail = email;
  user.contactOtp = hashOtp(otp);
  user.contactOtpTries = 0;
  user.contactOtpExpire = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendOtpEmail({
    to: email,
    name: user.name,
    otp,
    purpose: "verify-email",
  });
  res.json({ success: true, message: "Code sent to the email" });
});

const verifyEmailVerifyOtp = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "+pendingEmail +contactOtp +contactOtpExpire +contactOtpTries",
  );
  if (
    !user ||
    !user.pendingEmail ||
    !(await checkOtp(user, String(req.body.otp || ""), {
      hashField: "contactOtp",
      expireField: "contactOtpExpire",
      triesField: "contactOtpTries",
    }))
  ) {
    res.status(400);
    throw new Error("This code is invalid or has expired");
  }
  const email = user.pendingEmail;
  if (
    email !== user.email &&
    (await User.findOne({ email, _id: { $ne: user._id } }))
  ) {
    res.status(400);
    throw new Error("This email is already in use");
  }

  const changed = email !== user.email;
  user.email = email;
  user.emailVerified = true;
  user.pendingEmail = undefined;
  user.contactOtp = undefined;
  user.contactOtpExpire = undefined;
  user.contactOtpTries = 0;
  await user.save();
  if (changed) await Employee.updateMany({ user: user._id }, { email });

  const updated = user.toObject();
  delete updated.password;
  res.json({ success: true, message: "Email verified", data: updated });
});

module.exports = {
  assertNewPassword,
  finishPasswordReset,
  listSessions,
  removeSession,
  removeOtherSessions,
  listTrustedDevices,
  removeTrustedDevices,
  backupCodesStatus,
  generateBackupCodes,
  loginWithBackupCode,
  resetPasswordWithBackupCode,
  loginRequestEmailOtp,
  loginVerifyEmailOtp,
  sendEmailVerifyOtp,
  verifyEmailVerifyOtp,
};
