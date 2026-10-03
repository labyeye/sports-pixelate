// One-off: encrypts every plaintext file already in UPLOAD_DIR (uploads made
// before encryption at rest was added). Safe to re-run — encrypted files are
// skipped. Back up the uploads folder and UPLOAD_ENCRYPTION_KEY first.
//
//   node scripts/encryptExistingUploads.js --dry-run   # list what would change
//   node scripts/encryptExistingUploads.js             # encrypt in place
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { UPLOAD_DIR } = require("../config/paths");
const { isFileEncrypted, encryptFileInPlace } = require("../utils/fileCrypto");

const dryRun = process.argv.includes("--dry-run");

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && !entry.name.endsWith(".tmp")) yield full;
  }
}

let converted = 0;
let alreadyEncrypted = 0;
let failed = 0;

if (!fs.existsSync(UPLOAD_DIR)) {
  console.log(`Nothing to do: ${UPLOAD_DIR} does not exist`);
  process.exit(0);
}

for (const file of walk(UPLOAD_DIR)) {
  try {
    if (isFileEncrypted(file)) {
      alreadyEncrypted++;
    } else if (dryRun) {
      console.log(`would encrypt ${path.relative(UPLOAD_DIR, file)}`);
      converted++;
    } else {
      encryptFileInPlace(file);
      converted++;
    }
  } catch (e) {
    failed++;
    console.error(`FAILED ${path.relative(UPLOAD_DIR, file)}: ${e.message}`);
  }
}

console.log(
  `${dryRun ? "Would encrypt" : "Encrypted"} ${converted}, already encrypted ${alreadyEncrypted}, failed ${failed}`,
);
process.exit(failed ? 1 : 0);
