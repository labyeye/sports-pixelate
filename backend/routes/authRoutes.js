const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  register,
  login,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
  setup2FA,
  confirm2FA,
  disable2FA,
  verify2FA,
  sendOtp,
  verifyOtp,
  forgotPasswordMethods,
  forgotPasswordWhatsapp,
  resetPasswordWithOtp,
  resetPasswordWithTotp,
  sendPhoneVerifyOtp,
  verifyPhoneVerifyOtp,
  selectAcademy,
  listAcademies,
  switchAcademy,
} = require("../controllers/authController");
const {
  registerOptions,
  registerVerify,
  listPasskeys,
  deletePasskey,
  loginOptions,
  loginVerify,
  resetOptions,
  resetVerify,
} = require("../controllers/passkeyController");
const {
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
} = require("../controllers/securityController");
const { protect, requirePlanFeature } = require("../middleware/auth");
const router = express.Router();

// Each call makes a separate limiter, so routes don't share one counter (sending a
// code and then verifying it used to burn the same 5-per-15-minutes budget).
// Signed-in routes are counted per user, public ones per IP.
const limiter = (max = 5) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    message: {
      success: false,
      message: "Too many attempts, please wait a few minutes and try again.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.user ? `u:${req.user._id}` : req.ip),
  });

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);

router.post("/forgot-password", limiter(5), forgotPassword);
router.post("/reset-password/:token", limiter(5), resetPassword);

router.get("/forgot-password/methods", limiter(10), forgotPasswordMethods);
router.post("/forgot-password/whatsapp", limiter(5), forgotPasswordWhatsapp);
router.post("/reset-password/otp/whatsapp", limiter(5), resetPasswordWithOtp);
router.post("/reset-password/otp/totp", limiter(5), resetPasswordWithTotp);

router.post("/phone/send-otp", protect, limiter(10), sendPhoneVerifyOtp);
router.post("/phone/verify-otp", protect, limiter(10), verifyPhoneVerifyOtp);

router.post("/otp/send", limiter(5), sendOtp);
router.post("/otp/verify", limiter(5), verifyOtp);
// Parent in several academies: pick one after OTP, or hop between them later.
router.post("/otp/select-academy", limiter(10), selectAcademy);
router.get("/academies", protect, listAcademies);
router.post("/switch-academy", protect, limiter(10), switchAcademy);
router.post("/2fa/verify", verify2FA);

router.post("/2fa/setup", protect, requirePlanFeature("twoFactor"), setup2FA);
router.post(
  "/2fa/confirm",
  protect,
  requirePlanFeature("twoFactor"),
  confirm2FA,
);
router.post(
  "/2fa/disable",
  protect,
  requirePlanFeature("twoFactor"),
  disable2FA,
);

// ── Passkeys ────────────────────────────────────────────────────────────
router.post("/passkey/register-options", protect, registerOptions);
router.post("/passkey/register", protect, registerVerify);
router.get("/passkey", protect, listPasskeys);
router.delete("/passkey/:id", protect, deletePasskey);
router.get("/passkey/login-options", limiter(10), loginOptions);
router.post("/passkey/login", limiter(10), loginVerify);
router.get("/reset/passkey-options", limiter(5), resetOptions);
router.post("/reset/passkey", limiter(10), resetVerify);

// ── Signed-in devices ───────────────────────────────────────────────────
router.get("/sessions", protect, listSessions);
router.delete("/sessions", protect, removeOtherSessions);
router.delete("/sessions/:id", protect, removeSession);

// ── "Keep me signed in" devices ─────────────────────────────────────────
router.get("/trusted-devices", protect, listTrustedDevices);
router.delete("/trusted-devices", protect, removeTrustedDevices);
router.delete("/trusted-devices/:id", protect, removeTrustedDevices);

// ── Backup codes ────────────────────────────────────────────────────────
router.get("/backup-codes", protect, backupCodesStatus);
router.post("/backup-codes", protect, limiter(5), generateBackupCodes);
router.post("/login/backup", limiter(10), loginWithBackupCode);
router.post("/reset/backup", limiter(10), resetPasswordWithBackupCode);

// ── Email OTP sign-in + email verification ──────────────────────────────
router.post("/login/email-otp/send", limiter(5), loginRequestEmailOtp);
router.post("/login/email-otp/verify", limiter(10), loginVerifyEmailOtp);
router.post("/contact/email/send-otp", protect, limiter(5), sendEmailVerifyOtp);
router.post(
  "/contact/email/verify-otp",
  protect,
  limiter(10),
  verifyEmailVerifyOtp,
);

module.exports = router;
