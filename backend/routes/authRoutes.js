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
} = require("../controllers/authController");
const { protect, requirePlanFeature } = require("../middleware/auth");
const router = express.Router();

// Strict limiter for sensitive unauthenticated auth endpoints
const sensitiveLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);

router.post("/forgot-password", sensitiveLimit, forgotPassword);
router.post("/reset-password/:token", sensitiveLimit, resetPassword);

router.post("/otp/send", sensitiveLimit, sendOtp);
router.post("/otp/verify", sensitiveLimit, verifyOtp);

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
router.post("/2fa/verify", verify2FA);

module.exports = router;
