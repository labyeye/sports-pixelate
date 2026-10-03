const jwt = require("jsonwebtoken");
const path = require("path");
const User = require("../models/User");
const { UPLOAD_DIR } = require("../config/paths");

// Folders under /uploads that must never be world-readable.
//  - IDENTITY_DIRS: Aadhaar / PAN / resumes / document vault. Always served
//    through authenticated download endpoints, so the static path is simply
//    closed.
//  - PROOF_DIRS: payment screenshots uploaded by parents. Owner/HR can view
//    them (<img> tags can't send headers, so a `?token=` JWT is accepted too)
//    and only for their own academy — filenames start with the company id.
const IDENTITY_DIRS = [
  "employee-aadhaar",
  "employee-pan",
  "employee-resume",
  "employee-docs",
];
const PROOF_DIRS = ["payment-screenshots"];

async function uploadGuard(req, res, next) {
  // Resolve exactly as the static handlers will ("/./x", "/a/../x", "%2e" all
  // collapse here), then judge the real first folder — not the raw path.
  let rel;
  try {
    const abs = path.resolve(UPLOAD_DIR, "." + decodeURIComponent(req.path));
    if (abs !== UPLOAD_DIR && !abs.startsWith(UPLOAD_DIR + path.sep))
      return res.sendStatus(403);
    rel = path.relative(UPLOAD_DIR, abs);
  } catch {
    return res.sendStatus(400);
  }
  const parts = rel.split(path.sep).filter(Boolean);
  const folder = (parts[0] || "").toLowerCase();

  if (IDENTITY_DIRS.includes(folder)) {
    return res.status(403).json({
      success: false,
      message: "This file is private. Use the in-app download.",
    });
  }
  if (!PROOF_DIRS.includes(folder)) return next();

  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ")
      ? header.split(" ")[1]
      : req.query.token;
    if (!token) return res.sendStatus(401);
    const decoded = jwt.verify(String(token), process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("role company status");
    if (!user || user.status === "inactive") return res.sendStatus(401);
    if (!["super_admin", "hr_manager"].includes(user.role))
      return res.sendStatus(403);
    const file = parts[parts.length - 1] || "";
    if (!file.startsWith(`${user.company}_`)) return res.sendStatus(403);
    return next();
  } catch {
    return res.sendStatus(401);
  }
}

module.exports = { uploadGuard };
