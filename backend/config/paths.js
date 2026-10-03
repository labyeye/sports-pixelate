const path = require("path");

// Where user uploads live. Defaults to ./uploads next to the code, but on a
// real host this must point at a persistent volume (UPLOAD_DIR=/data/uploads),
// otherwise files vanish on every redeploy.
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, "../uploads");

// Turns a stored reference ("uploads/employee-pan/x.pdf" or "/uploads/…")
// into an absolute path inside UPLOAD_DIR.
function resolveStoredPath(stored) {
  const rel = String(stored).replace(/^\/?uploads\//, "");
  return path.resolve(UPLOAD_DIR, rel);
}

module.exports = { UPLOAD_DIR, resolveStoredPath };
