// Optional error monitoring. Set SENTRY_DSN to turn it on; without it every
// call is a no-op, so local development needs nothing.
let Sentry = null;

function init() {
  if (!process.env.SENTRY_DSN || Sentry) return;
  Sentry = require("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
    sendDefaultPii: false,
  });
}

function captureError(err, context) {
  if (!Sentry) return;
  Sentry.withScope((scope) => {
    if (context) scope.setContext("job", context);
    Sentry.captureException(err);
  });
}

function attachExpress(app) {
  if (Sentry) Sentry.setupExpressErrorHandler(app);
}

module.exports = { init, captureError, attachExpress };
