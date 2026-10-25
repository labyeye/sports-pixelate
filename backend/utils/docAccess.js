const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const { sendPhoneOtp } = require("../services/whatsappService");

// Confidential documents (Aadhaar, PAN, résumés, the document vault) can only
// be opened after the signed-in user proves they hold their own WhatsApp number:
// a 6-digit OTP is sent to it, and the verified OTP yields a short-lived
// "doc access" token that every document download must carry.
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_GAP_MS = 30 * 1000;
const MAX_TRIES = 5;
const ACCESS_TTL = "10m";

const hashOtp = (otp) =>
  crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update("doc:" + String(otp).trim())
    .digest("hex");

const sendDocOtp = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "+docOtpSentAt phone",
  );
  if (!user?.phone) {
    res.status(400);
    throw new Error(
      "Add and verify your WhatsApp number in your profile to open confidential documents.",
    );
  }
  if (
    user.docOtpSentAt &&
    Date.now() - user.docOtpSentAt.getTime() < RESEND_GAP_MS
  ) {
    res.status(429);
    throw new Error("Please wait a few seconds before requesting another OTP.");
  }
  const otp = String(crypto.randomInt(100000, 1000000));
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        docOtp: hashOtp(otp),
        docOtpExpire: new Date(Date.now() + OTP_TTL_MS),
        docOtpTries: 0,
        docOtpSentAt: new Date(),
      },
    },
  );
  try {
    await sendPhoneOtp(user.phone, { otp });
  } catch (err) {
    res.status(502);
    throw new Error("Could not send the WhatsApp OTP. Please try again.");
  }
  const tail = String(user.phone).replace(/\D/g, "").slice(-4);
  res.json({ success: true, message: `OTP sent on WhatsApp to ••••${tail}` });
});

const verifyDocOtp = asyncHandler(async (req, res) => {
  const otp = String(req.body?.otp || "").trim();
  if (!/^\d{6}$/.test(otp)) {
    res.status(400);
    throw new Error("Enter the 6-digit OTP");
  }
  const user = await User.findById(req.user._id).select(
    "+docOtp +docOtpExpire +docOtpTries",
  );
  if (
    !user?.docOtp ||
    !user.docOtpExpire ||
    user.docOtpExpire < new Date() ||
    (user.docOtpTries || 0) >= MAX_TRIES
  ) {
    res.status(401);
    throw new Error("OTP expired. Request a new one.");
  }
  const a = Buffer.from(user.docOtp, "hex");
  const b = Buffer.from(hashOtp(otp), "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await User.updateOne({ _id: user._id }, { $inc: { docOtpTries: 1 } });
    res.status(401);
    throw new Error("Incorrect OTP");
  }
  // Single use: the code is burned the moment it is accepted.
  await User.updateOne(
    { _id: user._id },
    { $unset: { docOtp: 1, docOtpExpire: 1 }, $set: { docOtpTries: 0 } },
  );
  const token = jwt.sign(
    { purpose: "doc_access", id: String(user._id) },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: ACCESS_TTL },
  );
  res.json({ success: true, data: { docAccessToken: token, expiresInSec: 600 } });
});

// Guards a download route. The token travels in `x-doc-access` (API calls) or
// `?docToken=` (links opened by the browser).
const requireDocAccess = (req, res, next) => {
  const token = req.headers["x-doc-access"] || req.query.docToken;
  try {
    const d = jwt.verify(String(token || ""), process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (d.purpose === "doc_access" && d.id === String(req.user._id))
      return next();
  } catch {
    /* fall through */
  }
  res.status(403).json({
    success: false,
    code: "DOC_OTP_REQUIRED",
    message: "Confirm the WhatsApp OTP to open this document.",
  });
};

module.exports = { sendDocOtp, verifyDocOtp, requireDocAccess };
