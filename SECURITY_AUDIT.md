# NestPlay — Security Audit (backend · web · mobile)

Date: 2026-10-03 · Scope: `backend/`, `frontend/` (web), `NestSports/` (mobile)
Status: **REPORT ONLY — no code has been changed.** Fixes are proposed at the end for your approval.

## 0. Method and limits

- **Done:** manual read of `server.js`, every router and its guards, the auth/employee/student/subscription/billing/biometric/document/CRM controllers, upload middleware, the web API client and print/report code, Android/iOS config, `npm audit` on all three packages, secret scan of tracked files and git history.
- **Executed (proof, not just reading):** a local test of the `/uploads` guard (finding C-1) and a Mongoose cast test of operator injection (finding C-2).
- **Not done:** no live pen-test, no running DB, no production logs/config, no review of the Python face service or the separate `final-pixelate` dashboard that shares `JWT_SECRET`/`CRM_API_SECRET`.
- **Tags:** **[Proven]** I ran it · **[Confirmed]** I read the full code path · **[Verify]** needs a live check.
- **Severity:** **Critical** = fix before next release · **High** · **Medium** · **Low**.
- This audit **re-checks the fixes claimed in `AUDIT_REPORT.md` §12** and finds that one of them (S-6) does not hold.

## 1. Summary

| # | Sev | Finding | Area |
|---|---|---|---|
| C-1 | **Critical** | Private-document guard on `/uploads` is bypassed with `/./` or `/x/../` — **[Proven]** | backend |
| C-2 | **Critical** | NoSQL operator injection lets an unauthenticated caller act as *any* biometric device (face enroll, attendance injection) | backend |
| C-3 | **Critical** | Cross-tenant account takeover: create an employee with a victim's email, then reset their password | backend |
| H-1 | High | Any logged-in user (parents included) can read every employee's salary, bank, PAN, DOB, face data | backend |
| H-2 | High | Parents can list and download every employee's vault documents; see all leave & attendance | backend |
| H-3 | High | Stored XSS in printed reports (no HTML escaping) → owner token theft | web |
| H-4 | High | Student-fee payments: any staff `employee` can verify/reject payments and cancel subscriptions | backend |
| H-5 | High | `/api/company/*` (register/login/upgrade) has no rate limit, no validation, and an operator-injection path | backend |
| M-1 | Medium | No JWT revocation; 30-day token; password change/reset doesn't invalidate sessions | backend/web/mobile |
| M-2 | Medium | Uploads trust client MIME and client-supplied extension → active content served from API origin | backend |
| M-3 | Medium | Cross-tenant `verifyPayment` lookup is not company-scoped | backend |
| M-4 | Medium | Weak password rules on admin-set passwords (min 6); strong rule only on self-service | backend |
| M-5 | Medium | No security headers on the web app (CSP, frame-ancestors, etc.) | web |
| M-6 | Medium | Unescaped regex / unvalidated query params (ReDoS, operator injection in filters) | backend |
| M-7 | Medium | Rate-limit gaps: `/iclock`, `/api/crm`, `/internal/stats`, `/api/company`, WhatsApp webhook mounted before limiter | backend |
| M-8 | Medium | Vulnerable dependencies (xlsx has no fix; web 8, mobile 13, backend 1) | all |
| L-1…L-9 | Low | See §4 | all |

Scorecard (my view): Access control 4/10 · Input validation 4/10 · AuthN 6/10 · Secrets/config 7/10 · Transport/headers 5/10 · Dependencies 5/10.

What is genuinely good (keep): helmet + HSTS on the API, strict prod CORS (fatal if unset), bcrypt, hashed reset tokens, OTP stored hashed with a per-account attempt cap, 2FA with lockout, `.env` never committed (checked history), tenant-scoped `findOne({_id, company})` on most handlers, stripProtected on updates, route-guard unit table, Razorpay HMAC, mobile token in Keychain/Keystore, `allowBackup=false`, iOS ATS on.

---

## 2. Critical

### C-1 · `/uploads` identity-document guard is bypassable [Proven]

- **Where:** `backend/middleware/uploadGuard.js:21-26`, mounted at `server.js:~88`.
- **Problem:** the guard decides using the *first path segment* of the raw request path, but `express.static` normalises the path afterwards. `/uploads/./employee-aadhaar/<file>`, `/uploads/x/../employee-aadhaar/<file>` and `/uploads/%2e/employee-aadhaar/<file>` all pass the guard and the file is served.
- **Proof:** I ran the real `uploadGuard` + `express.static`: direct path → `403`; the three variants → `200` with file content. (The earlier audit marked S-6 "Fixed".)
- **Impact:** Aadhaar, PAN, résumés and vault documents are readable without authentication, provided the filename is known. The name is `${companyId}_${employeeId}_aadhaarDoc.ext`; the company and employee IDs are returned by the API to *every* user of the academy (see H-1), so any parent/employee can build the URL. The same bypass applies to `payment-screenshots` (token check skipped).
- **Fix:** don't serve private folders through `express.static` at all. Normalise first (`path.posix.normalize`) and reject `..`, or better, mount `express.static` only on an explicit allow-list of public folders (`company-logos`, `avatars`, `event-*`, `guardian-photos`, `inventory-photos`) and serve everything else only through authenticated handlers. Add a regression test with the three payloads above. Long-term: private object storage + signed URLs.

### C-2 · Operator injection → unauthenticated device impersonation

- **Where:** `controllers/biometricController.js:431` (`recordBiometric`), `:740` (`enrollFaceFromDevice`); `routes/admsRoutes.js:376` (`resolveDevice`), `:389`, `:521`, `:555` (`?SN=`).
- **Problem:** `deviceToken` (JSON body) and `SN` (query string — Express parses `SN[$ne]=x` into an object) go straight into `BiometricDevice.findOne({ deviceToken, isActive:true })` / `findOneAndUpdate({ serialNumber: sn })`. Mongoose does not sanitise operators by default. I confirmed the filter survives casting unchanged (`{"deviceToken":{"$ne":null},"isActive":true}`).
- **Impact (unauthenticated, any tenant):** matching the first active device, an attacker can
  - post attendance punches for employees/students of that device's academy (fake presence → payroll manipulation; the biometric user id is a small integer, trivially guessable),
  - overwrite face templates (`BIODATA`, `device-face-enroll`) so the attacker's face matches a victim,
  - pull pending device commands (`/getrequest`).
- **Fix:** coerce and validate (`typeof x === "string" && /^[a-f0-9]{64}$/`), set `mongoose.set("sanitizeFilter", true)` globally, add `express-mongo-sanitize`-style middleware. For ADMS, also add a per-device secret / IP allow-list (prior S-10) since serial numbers are guessable.

### C-3 · Cross-tenant account takeover via employee creation + password reset

- **Where:** `controllers/employeeController.js:223-226` (`createEmployee`) and `:444-474` (`resetEmployeePassword`).
- **Problem:** `createEmployee` does `User.findOne({ email })` with **no company check** and, if it exists (in *any* academy, any role), links the new Employee to that user. `resetEmployeePassword` then does `User.findOne({ email: employee.email })` (also unscoped) and sets a new password. Role gate is `hr_executive` and above.
- **Attack:** an attacker registers their own academy (public), creates an employee whose email is the victim's login email, then calls `POST /api/employees/:id/reset-password` with a password they choose → logs in as the victim, including another academy's `super_admin`. Needs only the victim's email address.
- **Fix:** in create, if a user with that email exists and `existingUser.company` ≠ this company (or role isn't `employee`), reject. In reset, require `linkedUser.company == req.user.company && linkedUser.role === "employee"` and that the actor outranks the target (an `hr_executive` must not reset an owner/HR manager). Prefer an email-based "set password" link rather than a body-supplied password. Audit-log the action and notify the user.

---

## 3. High

### H-1 · Employee directory exposes salary, bank and identity data to every role

- **Where:** `routes/employeeRoutes.js:28-31` (`GET /`, `GET /:id` use only `protect`), `controllers/employeeController.js:62-135`; fields in `models/Employee.js:36-93,115-118` (salary, bankAccount, ifscCode, panNumber, UAN/ESIC/PF, dateOfBirth, loanBalance, `faceDescriptor`) — none are `select:false`.
- **Impact:** a parent or any employee gets a colleague's salary, bank account, PAN, DOB and a biometric face vector. Also supplies the IDs needed for C-1.
- **Fix:** managers get the full view; other roles get a minimal projection (`name, designation, department, avatar`) or only their own record. Mark `faceDescriptor`, `deviceFaceTemplate`, bank and PAN fields `select:false`.

### H-2 · "Not employee" role logic lets `parent` (and others) see employee data

- **Pattern:** many handlers restrict only `if (role === "employee")` (and 22 more use `role === "parent"` as a *deny*-list). Any role not named falls through to the unrestricted branch.
- **Confirmed instances:** `GET /api/documents` and `/:id/download` (`documentController.js:116-190`, vault of Aadhaar/PAN/contracts — a parent gets the lot); `GET /api/leaves` (`leaveController.js:93`, includes reasons/medical); `GET /api/attendance` (`attendanceController.js:230`); `GET /api/attendance-corrections` (`routes/attendanceCorrectionRoutes.js:10`).
- **Fix:** switch to allow-lists per route (`authorize(...)`) and make the "self-only" branch the default for any non-manager role. The existing route-guard test table is the right place to lock this in (add: parent → 403 for each).

### H-3 · Stored XSS in print/report windows (web)

- **Where:** `frontend/src/lib/reportPrintHTML.ts` (cells/titles/headers interpolated raw into a template), written with `window.open("")` + `document.write` in `ReportsPage.tsx:490`, `ParentReportPage.tsx:55`, `PayrollPage.tsx:670`, `EmployeePayrollPage.tsx:99`, `EmployeeReportPage.tsx:168`, `BillingPage.tsx:134`, `WelcomePage.tsx:74`. There is no escape/sanitise helper anywhere in the web code.
- **Impact:** the new window is same-origin, so injected script can read `localStorage["hrms_token"]` (30-day JWT). Any user who controls a displayed string can attack whoever prints: a parent can set their own name to `<img src=x onerror=…>` (80 chars is plenty) via `PUT /api/auth/profile`; an employee likewise; student/guardian names come from imports. An owner printing the guardian or payroll report loses their account.
- **Fix:** HTML-escape every interpolated value in `buildReportHTML` and the other templates (or build DOM nodes / use `textContent`), add a CSP (M-5), and consider a sandboxed iframe or PDF generation. Add server-side input rules for names (reject `<`/`>`).

### H-4 · Student-fee payments: staff can approve and cancel

- **Where:** `controllers/subscriptionController.js:826` (`verifyQrPayment`), `:858` (`rejectQrPayment`), `:929` (`cancelSubscription`), `:805` (`submitInstallmentPayment`); routes only `protect`.
- **Problem:** guard is `role === "parent"` deny-list, so `employee`, `department_head`, `hr_executive` can mark a pending QR payment as *verified* (fee shown as paid, receipt generated) or reject it, and cancel any subscription of the academy.
- **Impact:** insider fraud / collusion with no audit trail (no `logAudit`).
- **Fix:** `authorize("super_admin","hr_manager")` on verify/reject (+ cancel except a parent for own child), and write audit entries for every payment state change.

### H-5 · `/api/company/*` is unauthenticated, unthrottled and unvalidated

- **Where:** `server.js:121` mounts it *before* `authRateLimit`/`apiRateLimit`; `controllers/companyController.js:6-117`.
- **Problems:** (a) no rate limit on `register`/`login` → unlimited password guessing and mass registration; (b) `req.body.email` is used raw in `Company.findOne({ email })` → `{"email":{"$ne":null}}` makes `register` answer "already registered" for everyone (registration DoS) and shapes `login`; (c) `Plan.findOne({ planType:"starter" })` null → `starterPlan.monthlyPrice` throws → 500 if seed data is missing; (d) password has only `minlength:6`; (e) `upgradeSubscription` (company token) deactivates the paid subscription and creates an unpaid one → can lock an academy out (the company password is also a second credential nobody reviews: `_createCompanyAndActivate` sets a random one, so mostly dead code).
- **Fix:** if this legacy flow is unused (the web/mobile use user login + billing), **remove the routes**. Otherwise validate/typecast inputs, apply `authRateLimit`, and drop `upgradeSubscription`.

---

## 4. Medium and Low

**M-1 · Session lifetime / revocation.** `utils/generateToken.js` issues 30-day HS256 tokens; `protect` (`middleware/auth.js:21-35`) checks only user existence/status. A password reset, 2FA change or role change does not invalidate old tokens. Web stores the token in `localStorage` (readable by any XSS, see H-3). Fix: add `tokenVersion`/`passwordChangedAt` check, 15-min access + refresh rotation, httpOnly cookie for web. Also pin `algorithms:["HS256"]` in `jwt.verify`, and use separate secrets for platform-admin vs user tokens (`protectPlatformAdmin` shares `JWT_SECRET` with the external dashboard).

**M-2 · Upload hardening.** `middleware/upload.js`: most uploaders accept `file.mimetype.startsWith("image/")` (includes `image/svg+xml`) and build the stored extension from the client `originalname`. A file declared `image/png` named `x.html`/`.js`/`.svg` is stored with that extension and served same-origin from `/uploads` by `express.static` → script/HTML hosted on the API origin (CSP `script-src 'self'` allows a same-origin `.js`). Magic-byte check (`validateMagicBytes`) runs only in 5 of ~14 paths. Fix: allow-list extension derived from sniffed type, apply the sniff everywhere, set `X-Content-Type-Options: nosniff` and `Content-Disposition: attachment` for non-image types. Also validate `:id` params before putting them in filenames (`validateMongoId`).

**M-3 · Cross-tenant payment trigger.** `subscriptionController.verifyPayment` (`:372`) finds `StudentSubscription` by `razorpayOrderId` only. Any authenticated user of any academy can trigger verification (and notifications, `req.user.company` used for the notice) of another academy's order. The gateway still has to report success, so no free access, but add `company: req.user.company` (and parent-child check). Razorpay signature compare is `===` (`services/razorpayService.js:46`) — use `timingSafeEqual`.

**M-4 · Password policy.** Self-service requires 8+ with upper/lower/digit; admin-set paths (`resetEmployeePassword`, `updateParentCredentials`, student-form guardian password, employee create) accept 6 chars, and `Company`/`User` models only enforce `minlength:6`. Unify via one `assertStrongPassword()`.

**M-5 · Web has no security headers.** `frontend/vercel.json` only rewrites. Add `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. No `dangerouslySetInnerHTML`/`eval` found in React code (good); the XSS risk is the `document.write` templates in H-3.

**M-6 · Query handling.** `reportsController.js:154` `new RegExp(search)` unescaped (ReDoS, owner-only); `auditController.js:10` `$regex: action` unescaped; many filters take raw `req.query` values (`sport`, `batch`, `userId`, `studentId`…), so `?sport[$ne]=` changes the filter (still tenant-scoped). Fix: `escapeRegex`, type-check query values, `sanitizeFilter`.

**M-7 · Rate-limit ordering.** In `server.js`, `/iclock`, `/internal/stats`, `/api/crm`, `/api/whatsapp-webhook`, `/api/company` are mounted before any limiter. The CRM/stats secret and (C-2) device tokens can therefore be hammered. Move the global limiter above them (with a higher ceiling for devices) and add a short per-IP limit on CRM.

**M-8 · Dependencies** (`npm audit --omit=dev`): backend 1 moderate (`file-type`, ESM-only upgrade); web 8 (6 high: `xlsx` **no fix**, tailwind chain via `braces/micromatch/fast-glob/chokidar`; `react-router` moderate); mobile 13 high, mostly the React Native/metro toolchain plus `xlsx`. Replace `xlsx` with `exceljs`; upgrade `react-router`; the metro/tailwind items are build-time.

**Low**
- **L-1** `morgan("dev")` logs full URLs; `/internal/stats?key=` still accepted (secret in logs). Use header only; use `combined` with query redaction.
- **L-2** Static-secret compare with `!==` in `supportController.js:134`; one shared `CRM_API_SECRET` for CRM, stats and support. Use `timingSafeEqual` and per-integration keys.
- **L-3** CRM handlers return `err.message` on 500 (`crmController`), leaking internals; the CRM subscription update doesn't call `invalidateCompanyAccess`, so changes apply up to 30 s late.
- **L-4** WhatsApp webhook signature check fails *open* unless `NODE_ENV==="production"` — an unset `NODE_ENV` on the server disables it. Fail closed always; require the secret.
- **L-5** Phone isn't unique and `findUserByPhone` isn't company-scoped (`authController.js:35`), so a user can claim another person's number and OTP login may resolve to the wrong account. Add a unique verified-phone rule.
- **L-6** OTP/reset endpoints return different errors for deactivated accounts and `forgot-password/methods` reveals whether an email exists and its 2FA/WhatsApp state (user enumeration).
- **L-7** Android release silently falls back to the debug keystore (`android/app/build.gradle:121`); R8/minify off; `debug.keystore` is committed (standard RN template, but never reuse). Fail the release build if `NESTPLAY_UPLOAD_*` is missing. `usesCleartextTraffic` is a placeholder — confirm it resolves to `false` in release.
- **L-8** `PaymentWebViewScreen` loads gateway pages in a WebView; confirm `originWhitelist` is restricted to the gateway hosts and that no `onMessage` data is trusted. **[Verify]**
- **L-9** `express.json` 5 MB limit applies to all routes including unauthenticated ones; face descriptors and base64 uploads can be large. Lower the default, raise per-route.

---

## 5. Input-validation coverage

Good: auth register/login schemas, `validateMongoId` on newer routes (events, students, exits, parents), `escapeRegex` on most searches, pagination caps, `safeSort` whitelist, password length ≤128, bulk-import caps (200 rows).
Gaps: validation is opt-in per route (a minority of routes use `validateBody`); most controllers trust body shape (`req.body.x` strings vs objects). Bodies with `$`-operators/objects are not rejected anywhere (root cause of C-2, H-5, M-6). Numeric fields (amount, salary, percentages) lack upper bounds; dates aren't validated before `new Date()`; names/free-text allow `<>` (feeds H-3).
**Systemic fix:** (1) global `sanitizeFilter` + a body/query sanitiser that strips keys starting with `$` or containing `.`; (2) a shared validation layer (zod/joi) per route; (3) reject HTML in name-like fields.

## 6. Previous-audit items re-verified

| Prior ID | Claimed | My result |
|---|---|---|
| S-1/S-2 loan/shift/designation/… owner guards | Fixed | **Holds** (routes confirmed) |
| S-3 dashboard/billing guards | Fixed | **Holds** |
| S-4 mass assignment (`stripProtected`) | Fixed | **Mostly holds**; `eventController.updateEvent` and `settingController.updateSettings` still spread `req.body` (tenant-scoped, but `updateSettings` accepts any Setting field incl. secret keys — owner only) |
| S-6 public Aadhaar/PAN | Fixed | **Does NOT hold** → C-1 |
| S-7 subscription enforcement | Fixed | Holds in `protect`; exemptions broad (`/api/company`, `/api/support`) but acceptable |
| S-8 OTP brute force | Fixed | Holds for phone-OTP; **WhatsApp reset OTP (`resetOtp`) and `/otp/verify` still only IP-limited** — no per-account attempt counter on `resetPasswordWithOtp` (6-digit, 10 min) |
| S-9 webhook HMAC | Fixed | Holds (fail-open caveat L-4) |
| S-10 ADMS serial-only | Open | Still open and worse because of C-2 |
| S-14 MIME sniff | Open | Still open → M-2 |
| S-15 Android signing | Partly | Still partly → L-7 |

New in this audit: C-2, C-3, H-1…H-5, M-1 (revocation), M-3, M-5, M-6, M-7, L-3…L-6.
Also worth adding to the prior list: `resetPasswordWithOtp` brute force (6 digits, 5 req/15 min/IP ⇒ ≈ 480 guesses/day/IP; distributed attackers can enumerate 10⁶ within the 10-minute code lifetime).

## 7. Recommended fix order

**Phase 1 — this week (stop the bleeding)**
1. C-1 close the `/uploads` bypass (+ test).
2. C-2 operator-injection: global `sanitizeFilter`, string-type checks on `deviceToken`/`SN`/`activationCode`.
3. C-3 tenant+role checks in `createEmployee`/`resetEmployeePassword`.
4. H-1/H-2 allow-list roles on employees, documents, leaves, attendance, corrections; `select:false` on sensitive fields.
5. H-3 escape HTML in all print templates.
6. H-4 owner-only payment verify/reject/cancel + audit log.
7. H-5 remove or lock down `/api/company/*`; move rate limiters above CRM/ADMS/company.

**Phase 2 — this month**
M-1 token revocation + shorter sessions, M-2 upload hardening, M-3, M-4 unified password policy, M-5 web security headers, M-6, M-8 dependency upgrades, per-account limit on `resetOtp`.

**Phase 3 — plan**
Object storage + signed URLs, httpOnly cookie sessions for web, per-device ADMS secrets, per-integration CRM keys, zod validation on all routes, security regression tests (route-guard table for every role × route, path-traversal and operator-injection cases), CI `npm audit` gate.

## 8. Re-check commands

```bash
# C-1: expect 403 on all after the fix
curl --path-as-is -i "$API/uploads/./employee-aadhaar/<file>"
curl --path-as-is -i "$API/uploads/x/../employee-aadhaar/<file>"
# C-2: expect 400/404, never 200
curl -X POST "$API/api/biometric/record" -H 'content-type: application/json' \
  -d '{"deviceToken":{"$ne":null},"method":"pin","personType":"employee","personId":"<id>"}'
curl "$API/iclock/getrequest?SN[\$ne]=x"
# H-1/H-2: as a parent token, expect 403
curl -H "Authorization: Bearer $PARENT" "$API/api/employees" "$API/api/documents" "$API/api/leaves"
# deps
(cd backend && npm audit --omit=dev); (cd frontend && npm audit --omit=dev); (cd NestSports && npm audit --omit=dev)
```
