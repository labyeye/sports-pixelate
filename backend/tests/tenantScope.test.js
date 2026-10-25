// Tenant-isolation guard: a controller query that looks a record up by an id
// taken from the request must also be scoped by company (or by the signed-in
// user). New unscoped lookups fail this test until reviewed and allow-listed.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "../controllers");
const CALL =
  /\.(findById|findByIdAndUpdate|findByIdAndDelete|findOneAndUpdate|findOne|findOneAndDelete|updateOne|deleteOne)\(\s*(req\.(params|body|query)\.\w+|\{[^}]*req\.(params|body|query)[^}]*\})/g;

// Reviewed: each is scoped some other way than `company`. [file, call fragment]
const REVIEWED = [
  ["authController.js", "findOne({_id:req.user._id"], // the signed-in user only
  ["biometricController.js", "findOne({deviceToken"], // device identified by its secret token
  ["crmController.js", "findById(req.params.id)"], // platform offer codes, CRM secret
  ["crmController.js", "findByIdAndUpdate(req.params.id"],
  ["crmController.js", "findByIdAndDelete(req.params.id"],
  ["notificationController.js", "findOneAndUpdate("], // recipient = signed-in user
  ["securityController.js", "findOneAndDelete("], // userId = signed-in user
  ["supportController.js", "findByIdAndUpdate(req.params.id"], // CRM webhook, secret-protected
];
const squash = (t) => t.replace(/\s+/g, "");

test("no unreviewed controller lookup by request id without company scope", () => {
  const found = [];
  for (const f of fs.readdirSync(DIR)) {
    const src = fs.readFileSync(path.join(DIR, f), "utf8");
    let m;
    while ((m = CALL.exec(src))) {
      const head = src.slice(m.index, m.index + 200);
      if (/company/.test(head)) continue;
      const call = squash(src.slice(m.index + 1, m.index + 140));
      if (REVIEWED.some(([file, frag]) => file === f && call.startsWith(frag)))
        continue;
      found.push(
        `${f}: ${src.slice(m.index + 1, m.index + 100).replace(/\s+/g, " ")}`,
      );
    }
  }
  assert.deepStrictEqual(found, [], "Unscoped lookups:\n" + found.join("\n"));
});
