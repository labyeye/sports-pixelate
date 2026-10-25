const jwt = require("jsonwebtoken");

// Web sessions live in an httpOnly cookie, so page scripts (and any XSS) can
// never read the token. The mobile app does not send `x-client: web` and keeps
// using the Authorization header, unchanged.
const COOKIE = "nest_session";
const SENTINEL = "cookie-session"; // placeholder the web app keeps in place of the token
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // same as the JWT lifetime

const isProd = () => process.env.NODE_ENV === "production";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProd(),
    // The web app and API share a registrable domain (same site), so Lax works
    // and blocks the cookie on cross-site requests.
    sameSite: "lax",
    path: "/",
  };
}

const isWebClient = (req) => req.headers["x-client"] === "web";

function readCookie(req, name = COOKIE) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: MAX_AGE_MS });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, cookieOptions());
}

// True for a real session JWT (not a purpose-bound step token such as 2FA).
function isSessionToken(token) {
  const d = jwt.decode(String(token));
  return !!d && typeof d === "object" && !d.purpose && !!d.id;
}

// For web clients: moves any session token in a JSON response into the cookie
// and leaves a placeholder behind. Also clears the cookie when the web client
// removes its own device session (sign-out).
function webSessionMiddleware(req, res, next) {
  if (!isWebClient(req)) return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    try {
      const holder =
        body && typeof body === "object"
          ? body.data && typeof body.data.token === "string"
            ? body.data
            : typeof body.token === "string"
              ? body
              : null
          : null;
      if (holder && isSessionToken(holder.token)) {
        setSessionCookie(res, holder.token);
        holder.token = SENTINEL;
      }
      if (
        req.method === "DELETE" &&
        req.sessionId &&
        req.originalUrl
          .split("?")[0]
          .endsWith(`/auth/sessions/${req.sessionId}`)
      ) {
        clearSessionCookie(res);
      }
    } catch {
      /* never block the response */
    }
    return json(body);
  };
  next();
}

module.exports = {
  COOKIE,
  SENTINEL,
  readCookie,
  isWebClient,
  setSessionCookie,
  clearSessionCookie,
  webSessionMiddleware,
};
