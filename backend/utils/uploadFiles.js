const fs = require("fs");
const path = require("path");
const { UPLOAD_DIR } = require("../config/paths");
const logger = require("./logger");

/**
 * Deletes an uploaded file from disk given whatever the database stored for it:
 * "/uploads/avatars/x.jpg", "http://host/uploads/avatars/x.jpg" or
 * "uploads/employee-pan/x.pdf". Use it when a photo/document is replaced or
 * removed so old files don't pile up.
 *
 * Safe by design: ignores empty values, anything outside UPLOAD_DIR (also
 * blocks "../"), files that are already gone, and `keepPath` (the new file,
 * when a replacement reuses the same filename). Never throws.
 */
function removeStoredUpload(ref, keepPath) {
  if (!ref || typeof ref !== "string") return;
  const at = ref.indexOf("uploads/");
  if (at === -1) return;
  const abs = path.resolve(UPLOAD_DIR, ref.slice(at + "uploads/".length).split("?")[0]);
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) return;
  if (keepPath && path.resolve(keepPath) === abs) return;
  try {
    fs.rmSync(abs, { force: true });
  } catch (e) {
    logger.warn(`[uploads] could not remove ${path.basename(abs)}: ${e.message}`);
  }
}

module.exports = { removeStoredUpload };
