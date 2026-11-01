// Mass-assignment guard: keep only keys that are real top-level fields of `Model`, minus the ones a client must
// never set (tenant, ids, timestamps and anything passed in `blocked`). Replaces `{ ...req.body }` / `req.body`.
const ALWAYS_BLOCKED = ["_id", "__v", "company", "createdAt", "updatedAt"];

function bodyFor(Model, body, blocked = []) {
  const deny = new Set([...ALWAYS_BLOCKED, ...blocked]);
  const fields = new Set(
    Object.keys(Model.schema.paths).map((p) => p.split(".")[0]),
  );
  const out = {};
  for (const key of Object.keys(body || {})) {
    if (fields.has(key) && !deny.has(key)) out[key] = body[key];
  }
  return out;
}

module.exports = bodyFor;

if (require.main === module) {
  const assert = require("assert");
  const fake = {
    schema: {
      paths: { name: 1, "customShift.startTime": 1, company: 1, status: 1 },
    },
  };
  const out = bodyFor(
    fake,
    {
      name: "a",
      company: "other-tenant",
      customShift: { startTime: "9" },
      evil: 1,
      status: "x",
    },
    ["status"],
  );
  assert.deepStrictEqual(out, { name: "a", customShift: { startTime: "9" } });
  console.log("bodyFor ok");
}
