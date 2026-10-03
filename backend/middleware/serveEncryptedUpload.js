// Serves files under /uploads. Files are stored encrypted (utils/fileCrypto),
// so this decrypts them on the way out. Plaintext legacy files are passed on to
// express.static unchanged. Runs after uploadGuard, which already enforces who
// may read the private folders.
const fs = require("fs");
const path = require("path");
const { UPLOAD_DIR } = require("../config/paths");
const { isFileEncrypted, readDecrypted } = require("../utils/fileCrypto");
const logger = require("../utils/logger");

function serveEncryptedUpload(req, res, next) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();

  let abs;
  try {
    abs = path.resolve(UPLOAD_DIR, "." + decodeURIComponent(req.path));
  } catch {
    return next();
  }
  // Never read outside the uploads folder (path traversal).
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) return next();

  try {
    if (!fs.statSync(abs).isFile() || !isFileEncrypted(abs)) return next();
  } catch {
    return next(); // missing file -> express.static / 404
  }

  try {
    const plain = readDecrypted(abs);
    res.type(path.extname(abs) || "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.send(plain);
  } catch (e) {
    logger.error(`[uploads] could not decrypt ${path.basename(abs)}: ${e.message}`);
    return res.status(500).json({ success: false, message: "This file could not be opened." });
  }
}

module.exports = { serveEncryptedUpload };
