// Tiny leveled logger so operational output goes through one place instead of
// raw console calls. LOG_LEVEL=debug|info|warn|error (default: info in
// production, debug elsewhere). Swap the sinks here to ship logs elsewhere.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold() {
  const configured = String(process.env.LOG_LEVEL || "").toLowerCase();
  if (LEVELS[configured]) return LEVELS[configured];
  return process.env.NODE_ENV === "production" ? LEVELS.info : LEVELS.debug;
}

function write(level, sink, args) {
  if (LEVELS[level] >= threshold()) sink(...args);
}

module.exports = {
  debug: (...args) => write("debug", console.log, args),
  info: (...args) => write("info", console.log, args),
  warn: (...args) => write("warn", console.warn, args),
  error: (...args) => write("error", console.error, args),
};
