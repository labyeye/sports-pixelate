// Offline checks for the audit fixes (no database, no network): session revocation, 2FA step token, upload extensions.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const jwt = require("jsonwebtoken");

const gen = require("../utils/generateToken");

const stub = (rel, exports) => {
  const f = require.resolve(path.join(__dirname, "..", rel));
  require.cache[f] = { id: f, filename: f, loaded: true, exports };
};

test("protect: stale tokenVersion, purpose tokens and foreign signatures are refused", async () => {
  let dbUser = { _id: "u1", status: "active", tokenVersion: 1, company: null };
  stub("models/User.js", { findById: () => ({ select: async () => dbUser }) });
  stub("models/Company.js", {});
  stub("utils/planFeatures.js", { getCompanyFeatures: async () => ({}) });
  stub("utils/subscriptionStatus.js", {
    getCompanyAccess: async () => ({ live: true }),
  });
  delete require.cache[require.resolve("../middleware/auth.js")];
  const { protect } = require("../middleware/auth");
  const call = async (tok) => {
    let ok = false;
    const res = {
      status() {
        return this;
      },
    };
    await protect(
      { headers: { authorization: "Bearer " + tok }, baseUrl: "/api/x" },
      res,
      (e) => (ok = !e),
    );
    return ok;
  };
  assert.ok(await call(gen("u1", {}, 1)), "current token works");
  assert.ok(
    !(await call(gen("u1", {}, 0))),
    "token issued before a password change is rejected",
  );
  assert.ok(
    !(await call(gen.generatePendingToken("u1"))),
    "2FA pending token is not a session",
  );
  assert.ok(
    !(await call(jwt.sign({ id: "u1", tv: 1 }, "other-secret"))),
    "foreign signature rejected",
  );
  dbUser = { ...dbUser, tokenVersion: 2 };
  assert.ok(!(await call(gen("u1", {}, 1))), "bump retires older sessions");
});

test("2FA step needs the signed pending token, never a bare user id", () => {
  const pending = gen.generatePendingToken("507f1f77bcf86cd799439011");
  assert.strictEqual(
    gen.verifyPendingToken(pending).id,
    "507f1f77bcf86cd799439011",
  );
  assert.throws(() => gen.verifyPendingToken("507f1f77bcf86cd799439011"));
  assert.throws(
    () => gen.verifyPendingToken(gen("507f1f77bcf86cd799439011")),
    /purpose/,
  );
});

test("upload extension comes from the verified type, not the client file name", () => {
  const { safeExt } = require("../middleware/upload");
  assert.strictEqual(
    safeExt({ mimetype: "image/png", originalname: "x.html" }, ".png"),
    ".png",
  );
  assert.strictEqual(
    safeExt({ mimetype: "image/svg+xml", originalname: "x.svg" }, ".png"),
    ".png",
  );
  assert.strictEqual(
    safeExt(
      { mimetype: "application/octet-stream", originalname: "a.PDF" },
      ".png",
    ),
    ".pdf",
  );
  assert.strictEqual(
    safeExt({ mimetype: "text/html", originalname: "a.html" }, ".jpg"),
    ".jpg",
  );
});
