const crypto = require("crypto");

// Field-level encryption for the most sensitive personal data (bank account,
// PAN, Aadhaar, medical notes). Values are stored as
//   enc:v1:<base64(iv | authTag | ciphertext)>   (AES-256-GCM)
// so a copied database or backup shows no readable data. Reads decrypt
// transparently; legacy plaintext values still read fine until the migration
// script (scripts/encryptSensitiveFields.js) has converted them.
//
// Key: FIELD_ENCRYPTION_KEY (64 hex chars). Without it a key is derived from
// UPLOAD_ENCRYPTION_KEY or JWT_SECRET — set a dedicated one and never change
// it, or existing values become unreadable.
const PREFIX = "enc:v1:";
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey;
function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (raw) {
    if (!/^[0-9a-fA-F]{64}$/.test(raw))
      throw new Error("FIELD_ENCRYPTION_KEY must be 64 hex characters");
    cachedKey = Buffer.from(raw, "hex");
    return cachedKey;
  }
  const secret = process.env.UPLOAD_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error("FIELD_ENCRYPTION_KEY is not set");
  cachedKey = crypto.scryptSync(secret, "nestplay-field-encryption", 32);
  return cachedKey;
}

const isEncrypted = (v) => typeof v === "string" && v.startsWith(PREFIX);

function encryptValue(plain) {
  if (plain === undefined || plain === null || plain === "") return plain;
  if (isEncrypted(plain)) return plain;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([
    cipher.update(String(plain), "utf8"),
    cipher.final(),
  ]);
  return (
    PREFIX + Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64")
  );
}

function decryptValue(value) {
  if (!isEncrypted(value)) return value; // legacy plaintext
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), "base64");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getKey(),
      buf.subarray(0, IV_LEN),
    );
    decipher.setAuthTag(buf.subarray(IV_LEN, IV_LEN + TAG_LEN));
    return Buffer.concat([
      decipher.update(buf.subarray(IV_LEN + TAG_LEN)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Wrong key / corrupted value: never leak ciphertext to the client.
    return undefined;
  }
}

// Mongoose plugin: encrypts `fields` on write, decrypts on read, and makes
// toJSON/toObject return the decrypted values (no virtuals added).
function fieldEncryption(schema, fields) {
  for (const f of fields) {
    const path = schema.path(f);
    if (!path) throw new Error(`fieldEncryption: unknown path ${f}`);
    path.set(encryptValue);
    path.get(decryptValue);
  }
  for (const opt of ["toJSON", "toObject"]) {
    schema.set(opt, {
      ...(schema.get(opt) || {}),
      getters: true,
      virtuals: false,
    });
  }
}

module.exports = {
  fieldEncryption,
  encryptValue,
  decryptValue,
  isEncrypted,
  PREFIX,
};

// Biometric templates never leave the server: JSON output keeps the same shape
// (a 128-long vector / a non-empty marker) so "is a face enrolled?" checks in
// the apps keep working, but the real values are replaced.
function maskBiometrics(schema) {
  const prev = schema.get("toJSON") || {};
  schema.set("toJSON", {
    ...prev,
    transform(doc, ret, options) {
      const out = prev.transform
        ? prev.transform(doc, ret, options) || ret
        : ret;
      if (Array.isArray(out.faceDescriptor) && out.faceDescriptor.length)
        out.faceDescriptor = new Array(out.faceDescriptor.length).fill(0);
      if (out.deviceFaceTemplate) out.deviceFaceTemplate = "enrolled";
      return out;
    },
  });
}

module.exports.maskBiometrics = maskBiometrics;
