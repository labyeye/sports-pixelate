// NoSQL-injection guard: drops any key starting with "$" from request input
// (e.g. {"phone": {"$ne": null}}) so it can never reach a query as an operator.
// This replaces mongoose's global `sanitizeFilter`, which also rewrote the
// server's own `$in` / `$gte` / `$lt` filters and broke those queries.
function strip(value) {
  if (Array.isArray(value)) {
    value.forEach(strip);
  } else if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key.startsWith("$")) delete value[key];
      else strip(value[key]);
    }
  }
}

module.exports = function sanitizeInput(req, _res, next) {
  strip(req.body);
  strip(req.query);
  strip(req.params);
  next();
};
