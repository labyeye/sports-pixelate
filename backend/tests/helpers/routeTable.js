// Builds a table of every API route and which roles (if any) are guarded by
// `authorize(...)` — without a database or HTTP server. Router-level guards
// (`router.use(protect, authorize(...))`) are applied to routes registered after them.
const fs = require("fs");
const path = require("path");

const ROUTES_DIR = path.join(__dirname, "../../routes");
const WRITE = new Set(["post", "put", "patch", "delete"]);

function load(file) {
  try {
    return require(path.join(ROUTES_DIR, file));
  } catch (err) {
    return { __loadError: err.message };
  }
}

function buildRouteTable() {
  const rows = [];
  for (const file of fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".js"))) {
    const router = load(file);
    if (!router || router.__loadError || !router.stack) {
      rows.push({ file, error: router?.__loadError || "no router" });
      continue;
    }
    let routerRoles = null; // set by router.use(authorize(...))
    for (const layer of router.stack) {
      if (!layer.route) {
        if (layer.handle?.allowedRoles) routerRoles = layer.handle.allowedRoles;
        continue;
      }
      const handlers = layer.route.stack.map((l) => l.handle);
      const routeRoles =
        handlers.find((h) => h.allowedRoles)?.allowedRoles || routerRoles;
      for (const method of Object.keys(layer.route.methods)) {
        rows.push({
          file: file.replace("Routes.js", ""),
          method,
          path: layer.route.path,
          roles: routeRoles,
          write: WRITE.has(method),
        });
      }
    }
  }
  return rows;
}

module.exports = { buildRouteTable };
