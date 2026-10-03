// Encryption at rest for uploaded files (photos, IDs, documents).
//
// Every file saved under UPLOAD_DIR is encrypted with AES-256-GCM, so a copied
// disk, backup or storage bucket exposes only unreadable data. The server
// decrypts on the fly when a permitted request asks for the file.
//
// Stored layout: "NPENC1" (6 bytes) | IV (12) | auth tag (16) | ciphertext.
// GCM authenticates the data, so a tampered file fails to decrypt instead of
// returning garbage. Files without the "NPENC1" header are treated as legacy
// plaintext and passed through, so old uploads keep working until
// scripts/encryptExistingUploads.js converts them.
//
// Key: UPLOAD_ENCRYPTION_KEY = 64 hex characters (32 bytes), e.g.
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Keep it out of git and back it up separately: without it the files cannot
// be recovered. If it is missing, a key is derived from JWT_SECRET so uploads
// are still encrypted, but a warning is logged — set a dedicated key.
const crypto = require("crypto");
const fs = require("fs");

const MAGIC = Buffer.from("NPENC1");
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = MAGIC.length + IV_LEN + TAG_LEN;

let cachedKey = null;
let warned = false;

function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.UPLOAD_ENCRYPTION_KEY;
  if (raw) {
    if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
      throw new Error(
        "UPLOAD_ENCRYPTION_KEY must be 64 hex characters (32 bytes)",
      );
    }
    cachedKey = Buffer.from(raw, "hex");
    return cachedKey;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("UPLOAD_ENCRYPTION_KEY is not set");
  if (!warned) {
    warned = true;
    require("./logger").warn(
      "[fileCrypto] UPLOAD_ENCRYPTION_KEY not set — deriving a key from JWT_SECRET. Set a dedicated key.",
    );
  }
  cachedKey = crypto.scryptSync(secret, "nestplay-upload-encryption", 32);
  return cachedKey;
}

function isEncryptedBuffer(buf) {
  return buf.length >= HEADER_LEN && buf.subarray(0, MAGIC.length).equals(MAGIC);
}

function encryptBuffer(plain) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

// Returns the plaintext; a buffer without the header is returned unchanged.
function decryptBuffer(buf) {
  if (!isEncryptedBuffer(buf)) return buf;
  const iv = buf.subarray(MAGIC.length, MAGIC.length + IV_LEN);
  const tag = buf.subarray(MAGIC.length + IV_LEN, HEADER_LEN);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buf.subarray(HEADER_LEN)), decipher.final()]);
}

// Cheap check that only reads the first bytes of the file.
function isFileEncrypted(absPath) {
  const fd = fs.openSync(absPath, "r");
  try {
    const head = Buffer.alloc(MAGIC.length);
    const n = fs.readSync(fd, head, 0, MAGIC.length, 0);
    return n === MAGIC.length && head.equals(MAGIC);
  } finally {
    fs.closeSync(fd);
  }
}

// Writes via a temp file + rename so a crash never leaves a half-written file.
function writeAtomic(absPath, data) {
  const tmp = `${absPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, absPath);
}

// Encrypts a plaintext file in place. Returns false if it was already encrypted.
function encryptFileInPlace(absPath) {
  const buf = fs.readFileSync(absPath);
  if (isEncryptedBuffer(buf)) return false;
  writeAtomic(absPath, encryptBuffer(buf));
  return true;
}

// Reads a stored file and returns its plaintext bytes (legacy plaintext too).
function readDecrypted(absPath) {
  return decryptBuffer(fs.readFileSync(absPath));
}

// Saves bytes encrypted.
function writeEncrypted(absPath, plain) {
  writeAtomic(absPath, encryptBuffer(plain));
}

// Encrypts every file multer just wrote (req.file, req.files array or map).
function encryptUploadedFiles(req) {
  const files = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);
  else if (req.files) Object.values(req.files).forEach((list) => files.push(...list));
  for (const f of files) if (f.path) encryptFileInPlace(f.path);
}

module.exports = {
  isEncryptedBuffer,
  encryptBuffer,
  decryptBuffer,
  isFileEncrypted,
  encryptFileInPlace,
  readDecrypted,
  writeEncrypted,
  encryptUploadedFiles,
};
