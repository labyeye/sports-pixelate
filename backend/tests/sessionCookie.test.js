// Offline checks for the web httpOnly-cookie session (no database, no network).
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const test = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const {
  webSessionMiddleware,
  readCookie,
  SENTINEL,
} = require("../utils/sessionCookie");

const fakeRes = () => {
  const res = {
    cookies: {},
    cleared: [],
    cookie(n, v, o) {
      this.cookies[n] = { v, o };
    },
    clearCookie(n) {
      this.cleared.push(n);
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  return res;
};

test("web client: session token moves into an httpOnly cookie", () => {
  const session = jwt.sign({ id: "u1" }, process.env.JWT_SECRET);
  const req = {
    headers: { "x-client": "web" },
    method: "POST",
    originalUrl: "/api/auth/login",
  };
  const res = fakeRes();
  webSessionMiddleware(req, res, () => {});
  res.json({ success: true, data: { name: "A", token: session } });
  assert.equal(res.body.data.token, SENTINEL);
  assert.equal(res.cookies.nest_session.v, session);
  assert.equal(res.cookies.nest_session.o.httpOnly, true);
});

test("web client: purpose (2FA) tokens stay in the body, no cookie", () => {
  const step = jwt.sign({ id: "u1", purpose: "2fa" }, process.env.JWT_SECRET);
  const req = {
    headers: { "x-client": "web" },
    method: "POST",
    originalUrl: "/api/auth/login",
  };
  const res = fakeRes();
  webSessionMiddleware(req, res, () => {});
  res.json({ data: { requires2FA: true, token: step } });
  assert.equal(res.body.data.token, step);
  assert.deepEqual(res.cookies, {});
});

test("mobile client (no x-client header) keeps the token in the body", () => {
  const session = jwt.sign({ id: "u1" }, process.env.JWT_SECRET);
  const req = { headers: {}, method: "POST", originalUrl: "/api/auth/login" };
  const res = fakeRes();
  webSessionMiddleware(req, res, () => {});
  res.json({ data: { token: session } });
  assert.equal(res.body.data.token, session);
  assert.deepEqual(res.cookies, {});
});

test("removing the current device session clears the cookie", () => {
  const req = {
    headers: { "x-client": "web" },
    method: "DELETE",
    sessionId: "abc",
    originalUrl: "/api/auth/sessions/abc",
  };
  const res = fakeRes();
  webSessionMiddleware(req, res, () => {});
  res.json({ success: true });
  assert.deepEqual(res.cleared, ["nest_session"]);
});

test("readCookie parses the session cookie", () => {
  assert.equal(
    readCookie({ headers: { cookie: "a=1; nest_session=tok%20en; b=2" } }),
    "tok en",
  );
  assert.equal(readCookie({ headers: {} }), null);
});
