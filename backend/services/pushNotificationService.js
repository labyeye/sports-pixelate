const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription");

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@nesthr.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  vapidConfigured = true;
}

async function sendPushToEmployee(employeeId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  ensureVapid();
  const subs = await PushSubscription.find({ employee: employeeId });
  if (!subs.length) return;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify(payload),
          { TTL: 60 },
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    }),
  );
}

// ---- Native app push via FCM HTTP v1 (no firebase-admin dependency) ----------------------------------------------
// Set FCM_SERVICE_ACCOUNT to the Firebase service-account JSON (raw JSON string or a path to the file). Without it
// native pushes are skipped and employees still see the announcement inside the app.
let fcmCfg;
function fcmConfig() {
  if (fcmCfg !== undefined) return fcmCfg;
  try {
    const raw = process.env.FCM_SERVICE_ACCOUNT || "";
    fcmCfg = raw
      ? JSON.parse(
          raw.trim().startsWith("{")
            ? raw
            : require("fs").readFileSync(raw, "utf8"),
        )
      : null;
  } catch (e) {
    console.error("[FCM] bad FCM_SERVICE_ACCOUNT:", e.message);
    fcmCfg = null;
  }
  return fcmCfg;
}

let fcmTokenCache = { token: "", exp: 0 };
async function fcmAccessToken(cfg) {
  if (fcmTokenCache.exp > Date.now() + 60000) return fcmTokenCache.token;
  const jwt = require("jsonwebtoken");
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: cfg.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    cfg.private_key,
    { algorithm: "RS256" },
  );
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const d = await r.json();
  if (!d.access_token)
    throw new Error(d.error_description || "FCM auth failed");
  fcmTokenCache = {
    token: d.access_token,
    exp: Date.now() + (d.expires_in || 3600) * 1000,
  };
  return d.access_token;
}

async function sendFcm(tokens, { title, body, image, data }) {
  const cfg = fcmConfig();
  if (!cfg || !tokens.length) return;
  const access = await fcmAccessToken(cfg);
  await Promise.allSettled(
    tokens.map(async (t) => {
      const r = await fetch(
        `https://fcm.googleapis.com/v1/projects/${cfg.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: t.fcmToken,
              notification: { title, body, ...(image ? { image } : {}) },
              data: Object.fromEntries(
                Object.entries(data || {}).map(([k, v]) => [k, String(v)]),
              ),
            },
          }),
        },
      );
      if (r.status === 404 || r.status === 410)
        await PushSubscription.deleteOne({ _id: t._id });
    }),
  );
}

/** Web push + native push to a list of user ids. Never throws (callers fire-and-forget). */
async function notifyUsers(userIds, payload) {
  try {
    const ids = [...new Set(userIds.map(String))];
    if (!ids.length) return;
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      for (const id of ids) await sendPushToEmployee(id, payload);
    }
    const native = await PushSubscription.find({
      employee: { $in: ids },
      fcmToken: { $exists: true, $ne: null },
    });
    await sendFcm(native, payload);
  } catch (e) {
    console.error("[Push] notifyUsers failed:", e.message);
  }
}

module.exports = { sendPushToEmployee, notifyUsers };
