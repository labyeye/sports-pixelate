const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Subscription = require("../models/Subscription");
const generateToken = require("../utils/generateToken");
const { validateBody } = require("../middleware/validate");
const { sendPasswordResetEmail } = require("../services/notificationService");
const { sendPhoneOtp } = require("../services/whatsappService");
const { getCompanyFeatures } = require("../utils/planFeatures");

const registerSchema = {
  name: { required: true, type: "string", minLength: 2, maxLength: 80 },
  email: { required: true, email: true },
  password: { required: true, type: "string", minLength: 8, maxLength: 128 },
};

const loginSchema = {
  email: { required: true, email: true },
  password: { required: true, type: "string", minLength: 1, maxLength: 128 },
};

const STRONG_PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const register = [
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    if (!STRONG_PASSWORD_RE.test(password)) {
      res.status(400);
      throw new Error(
        "Password must be at least 8 characters and include uppercase, lowercase, and a number",
      );
    }

    if (await User.findOne({ email: email.toLowerCase() })) {
      res.status(400);
      throw new Error("An account with this email already exists");
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: "super_admin",
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  }),
];

const login = [
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).populate({
      path: "company",
      select: "name email phone status subscription website",
      populate: {
        path: "subscription",
        select:
          "status plan paymentStatus billingCycle monthlyPrice yearlyPrice maxStudents currentStudentCount renewalDate isTrial trialEndDate",
      },
    });

    if (!user || !(await user.matchPassword(password))) {
      res.status(401);
      throw new Error("Invalid email or password");
    }

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

    if (req.body.client === "mobile" && user.company) {
      const features = await getCompanyFeatures(user.company._id);
      if (!features.mobileApp) {
        res.status(403);
        throw new Error(
          "Your organization's plan does not include mobile app access.",
        );
      }
    }

    user.lastLogin = new Date();
    await user.save();

    if (user.twoFactorEnabled) {
      return res.json({
        success: true,
        data: { requires2FA: true, userId: user._id },
      });
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        status: user.status,
        department: user.department,
        company: user.company,
        token: generateToken(user._id),
      },
    });
  }),
];

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("-password")
    .populate("department", "name code")
    .populate({
      path: "company",
      select: "name email phone status subscription website",
      populate: {
        path: "subscription",
        select:
          "status plan paymentStatus billingCycle monthlyPrice yearlyPrice maxStudents currentStudentCount renewalDate isTrial trialEndDate",
      },
    });
  res.json({ success: true, data: user });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const { name, phone, avatar, password, currentPassword } = req.body;

  if (password) {
    if (!currentPassword) {
      res.status(400);
      throw new Error("Current password is required to set a new password");
    }
    if (!(await user.matchPassword(currentPassword))) {
      res.status(401);
      throw new Error("Current password is incorrect");
    }
    if (!STRONG_PASSWORD_RE.test(password)) {
      res.status(400);
      throw new Error(
        "New password must be at least 8 characters and include uppercase, lowercase, and a number",
      );
    }
    if (password.length > 128) {
      res.status(400);
      throw new Error("Password too long");
    }
    user.password = password;
  }

  if (name !== undefined) {
    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 80
    ) {
      res.status(400);
      throw new Error("Name must be between 2 and 80 characters");
    }
    user.name = name.trim();
  }
  if (phone !== undefined) {
    if (phone && (typeof phone !== "string" || phone.length > 20)) {
      res.status(400);
      throw new Error("Invalid phone number");
    }
    user.phone = phone;
  }
  if (avatar !== undefined) {
    if (avatar && avatar.length > 2_000_000) {
      res.status(400);
      throw new Error("Avatar image too large");
    }
    user.avatar = avatar;
  }

  await user.save();
  const updated = user.toObject();
  delete updated.password;
  res.json({ success: true, data: updated });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    return res.json({
      success: true,
      message: "If that email exists, a reset link has been sent.",
    });
  }

  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  user.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${token}`;
  try {
    await sendPasswordResetEmail({
      toEmail: user.email,
      toName: user.name,
      resetUrl,
    });
  } catch {}

  res.json({
    success: true,
    message: "If that email exists, a reset link has been sent.",
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || !STRONG_PASSWORD_RE.test(password)) {
    res.status(400);
    throw new Error(
      "Password must be at least 8 characters and include uppercase, lowercase, and a number",
    );
  }

  const hashed = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpire: { $gt: new Date() },
  });
  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired reset link");
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.json({
    success: true,
    message: "Password reset successful. You can now log in.",
  });
});

// 2FA setup — generates secret + QR code for authenticator app
const setup2FA = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const secret = speakeasy.generateSecret({
    name: `NestHR (${user.email})`,
    length: 32,
  });

  user.twoFactorSecret = secret.base32;
  user.pendingTwoFactor = true;
  await user.save();

  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
  res.json({ success: true, data: { secret: secret.base32, qr: qrDataUrl } });
});

// 2FA confirm — verifies a TOTP token, enables 2FA and returns backup codes
const confirm2FA = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) {
    res.status(400);
    throw new Error("Token is required");
  }

  const user = await User.findById(req.user._id);
  if (!user.twoFactorSecret) {
    res.status(400);
    throw new Error("2FA setup not initiated");
  }

  const valid = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: "base32",
    token,
    window: 1,
  });
  if (!valid) {
    res.status(400);
    throw new Error("Invalid code — try again");
  }

  const backupCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString("hex"),
  );
  user.twoFactorEnabled = true;
  user.pendingTwoFactor = false;
  user.twoFactorBackupCodes = backupCodes;
  await user.save();

  res.json({ success: true, data: { backupCodes } });
});

// 2FA disable
const disable2FA = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const user = await User.findById(req.user._id);
  if (!user.twoFactorEnabled) {
    res.status(400);
    throw new Error("2FA is not enabled");
  }

  const valid = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: "base32",
    token,
    window: 1,
  });
  if (!valid) {
    res.status(400);
    throw new Error("Invalid code");
  }

  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  user.twoFactorBackupCodes = [];
  user.pendingTwoFactor = false;
  await user.save();

  res.json({ success: true, message: "2FA disabled" });
});

// 2FA verify — called after first-step login when 2FA is enabled
const verify2FA = asyncHandler(async (req, res) => {
  const { userId, token } = req.body;
  if (!userId || !token) {
    res.status(400);
    throw new Error("userId and token are required");
  }

  const user = await User.findById(userId).populate({
    path: "company",
    select: "name email phone status subscription website",
    populate: {
      path: "subscription",
      select:
        "status plan paymentStatus billingCycle monthlyPrice yearlyPrice maxStudents currentStudentCount renewalDate isTrial trialEndDate",
    },
  });
  if (!user || !user.twoFactorEnabled) {
    res.status(400);
    throw new Error("Invalid request");
  }

  // Lockout check — 10 failed attempts locks for 30 minutes
  if (user.twoFactorLockUntil && user.twoFactorLockUntil > new Date()) {
    res.status(429);
    throw new Error(
      "Account temporarily locked due to too many failed 2FA attempts. Try again later.",
    );
  }

  const isBackup = user.twoFactorBackupCodes.includes(token);
  const isTotp = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: "base32",
    token,
    window: 1,
  });

  if (!isTotp && !isBackup) {
    user.twoFactorFailedAttempts = (user.twoFactorFailedAttempts || 0) + 1;
    if (user.twoFactorFailedAttempts >= 10) {
      user.twoFactorLockUntil = new Date(Date.now() + 30 * 60 * 1000);
      user.twoFactorFailedAttempts = 0;
    }
    await user.save();
    res.status(401);
    throw new Error("Invalid authentication code");
  }

  // Reset failure counter on success
  user.twoFactorFailedAttempts = 0;
  user.twoFactorLockUntil = undefined;

  if (isBackup) {
    user.twoFactorBackupCodes = user.twoFactorBackupCodes.filter(
      (c) => c !== token,
    );
  }
  await user.save();

  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      status: user.status,
      department: user.department,
      company: user.company,
      token: generateToken(user._id),
    },
  });
});

// Phone OTP — step 1: send OTP to WhatsApp
const sendOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    res.status(400);
    throw new Error("Phone number is required");
  }

  console.log(`[WA-OTP] controller entered, raw phone=${phone}`);
  const normalised = phone.replace(/\s/g, "").replace(/^\+91/, "").slice(-10);
  const phoneVariants = [normalised, `+91${normalised}`, `91${normalised}`];

  let user = await User.findOne({ phone: { $in: phoneVariants } });
  if (!user) {
    const employee = await Employee.findOne({ phone: { $in: phoneVariants } });
    if (employee) user = await User.findById(employee.user);
  }
  console.log(`[WA-OTP] lookup phone=${normalised} found=${!!user}`);
  if (!user) {
    // Return generic success to avoid user enumeration
    console.warn(
      `[WA-OTP] ABORT: no user matched phone=${normalised} (raw=${phone})`,
    );
    return res.json({
      success: true,
      message: "If that phone number is registered, an OTP has been sent.",
    });
  }

  if (user.status === "inactive") {
    res.status(403);
    throw new Error("Your account has been deactivated. Please contact HR.");
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.phoneOtp = crypto.createHash("sha256").update(otp).digest("hex");
  user.phoneOtpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await user.save();

  await sendPhoneOtp(normalised, { otp });

  res.json({
    success: true,
    message: "If that phone number is registered, an OTP has been sent.",
  });
});

// Phone OTP — step 2: verify OTP and return JWT
const verifyOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    res.status(400);
    throw new Error("Phone and OTP are required");
  }

  const hashed = crypto.createHash("sha256").update(otp.trim()).digest("hex");

  const user = await User.findOne({
    phoneOtp: hashed,
    phoneOtpExpire: { $gt: new Date() },
  }).populate({
    path: "company",
    select: "name email phone status subscription website",
    populate: {
      path: "subscription",
      select:
        "status plan paymentStatus billingCycle monthlyPrice yearlyPrice maxStudents currentStudentCount renewalDate isTrial trialEndDate",
    },
  });

  if (!user) {
    res.status(401);
    throw new Error("Invalid or expired OTP");
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

  user.phoneOtp = undefined;
  user.phoneOtpExpire = undefined;
  user.lastLogin = new Date();
  await user.save();

  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      status: user.status,
      department: user.department,
      company: user.company,
      token: generateToken(user._id),
    },
  });
});

module.exports = {
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
};
