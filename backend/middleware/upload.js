const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { fromFile } = require("file-type");

// Allowed MIME types matched against actual file magic bytes
const ALLOWED_MAGIC_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

async function validateMagicBytes(filePath) {
  const result = await fromFile(filePath);
  // result is undefined for plain text files — reject those too
  if (!result || !ALLOWED_MAGIC_MIME.has(result.mime)) {
    fs.unlinkSync(filePath);
    throw new Error(
      "File content does not match allowed types (PDF, JPG, PNG, WEBP)",
    );
  }
}

module.exports.validateMagicBytes = validateMagicBytes;

const UPLOAD_BASE = path.join(__dirname, "../uploads");

// Ensure upload dirs exist on startup
[
  "employee-aadhaar",
  "employee-pan",
  "employee-resume",
  "company-logos",
  "employee-docs",
  "payment-qr",
  "payment-screenshots",
].forEach((dir) => {
  const p = path.join(UPLOAD_BASE, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const employeeDocStorage = multer.diskStorage({
  destination(req, file, cb) {
    const folderMap = {
      aadhaarDoc: "employee-aadhaar",
      panDoc: "employee-pan",
      resumeDoc: "employee-resume",
    };
    cb(
      null,
      path.join(UPLOAD_BASE, folderMap[file.fieldname] || "employee-resume"),
    );
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    const safe = `${req.user.company}_${req.params.id}_${file.fieldname}${ext}`;
    cb(null, safe);
  },
});

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only PDF, JPG, PNG, WEBP files are allowed"), false);
}

const uploadEmployeeDocs = multer({
  storage: employeeDocStorage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
}).fields([
  { name: "aadhaarDoc", maxCount: 1 },
  { name: "panDoc", maxCount: 1 },
  { name: "resumeDoc", maxCount: 1 },
]);

const companyLogoStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.join(UPLOAD_BASE, "company-logos"));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const safe = `company_${req.user.company}${ext}`;
    cb(null, safe);
  },
});

const uploadCompanyLogo = multer({
  storage: companyLogoStorage,
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("logo");

const paymentQrStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.join(UPLOAD_BASE, "payment-qr"));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const safe = `qr_${req.user.company}${ext}`;
    cb(null, safe);
  },
});

const uploadPaymentQr = multer({
  storage: paymentQrStorage,
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("qrCode");

// Parent-submitted proof-of-payment screenshot for QR renewals
const paymentScreenshotStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.join(UPLOAD_BASE, "payment-screenshots"));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safe = `${req.user.company}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safe);
  },
});

const uploadPaymentScreenshot = multer({
  storage: paymentScreenshotStorage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
}).single("screenshot");

// Employee avatar upload
const avatarStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(UPLOAD_BASE, "avatars");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `avatar_${req.params.id}_${Date.now()}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("avatar");

// Student guardian (parent) photo upload
const guardianPhotoStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(UPLOAD_BASE, "guardian-photos");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `guardian_${req.params.guardianId}_${Date.now()}${ext}`);
  },
});

const uploadGuardianPhoto = multer({
  storage: guardianPhotoStorage,
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("photo");

// Document vault — generic file upload to disk
const documentVaultStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.join(UPLOAD_BASE, "employee-docs"));
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    const safe = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safe);
  },
});

const uploadDocumentVault = multer({
  storage: documentVaultStorage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
}).single("file");

// Attendance self-mark selfie upload (mobile geofenced check-in/out)
const attendanceSelfieStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(UPLOAD_BASE, "attendance-selfies");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safe = `${req.user.company}_${req.user._id}_${Date.now()}${ext}`;
    cb(null, safe);
  },
});

const uploadAttendanceSelfie = multer({
  storage: attendanceSelfieStorage,
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("selfie");

// Face enrollment photo — kept in memory only, forwarded to the face-recognition
// service and discarded (only the resulting embedding is persisted).
const uploadFaceEnrollPhoto = multer({
  storage: multer.memoryStorage(),
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("photo");

module.exports = {
  uploadEmployeeDocs,
  uploadCompanyLogo,
  uploadPaymentQr,
  uploadPaymentScreenshot,
  uploadDocumentVault,
  uploadAvatar,
  uploadGuardianPhoto,
  uploadAttendanceSelfie,
  uploadFaceEnrollPhoto,
  validateMagicBytes,
};
