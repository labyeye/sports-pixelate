# NestPlay — Deep Product & Engineering Audit

Date: 2026-10-01 · Scope: `backend/`, `frontend/` (web), `NestSports/` (mobile), docs, config.
Perspective: product manager + senior engineer.

## 0. How this was done (and its limits)

- **Method:** static reading of the code (routes → controllers → models, every router checked for role guards, every tenant-scoped query scanned), `npm audit`, `tsc`, grep-based metrics, and review of UI code. Line numbers below are exact as of this date.
- **Not done:** I did not run the app against a database, did not run a live pen-test, did not look at production logs, analytics or customer feedback. Anything marked *verify* needs a live check.
- **Confidence tags:** **[Confirmed]** = I read the code path and it behaves as described. **[Verify]** = strong signal, needs a live test.
- Severity: **P0** fix before next customer/release · **P1** fix this month · **P2** plan · **P3** nice to have.

---

## 1. Executive summary

NestPlay is unusually broad (47 web pages, 63 mobile screens, 58 data models, 44 API route files) and the best parts — multi-mode attendance, attendance→payroll linkage, parent portal, WhatsApp, events engine — are real differentiators.

The audit found **three kinds of problems that matter more than any missing feature**:

1. **Access control is inconsistent.** Several API routers only check "logged in", not "which role". The worst: *any logged-in user, including an employee or parent, can approve loans* (S-1). Subscription enforcement exists only in the web UI, not the API (S-7).
2. **Revenue leaks.** Lapsed customers keep API/mobile access; WhatsApp is given free to every subscriber (the exact bug fixed in July is back); there is no job that enforces student-subscription expiry or sends fee reminders (B-1…B-3).
3. **No safety net.** No automated tests, no CI, no error monitoring, broken lint, files on local disk, no company-first DB indexes.

### Scorecard

| Area | Score | One-line reason |
|---|---|---|
| Feature breadth | 9/10 | Covers academy + HR + events + biometrics + payments |
| Core academy workflow | 6/10 | Fees/dues/renewals/scheduling are the weakest links |
| Security / access control | 4/10 | Good basics (helmet, rate limit, 2FA, scoping) undermined by missing role guards |
| Reliability & ops | 3/10 | No tests/CI/monitoring; local-disk uploads; in-process cron |
| Performance & scale | 4/10 | Missing indexes, unbounded report queries, 4.6 MB single JS bundle |
| Web code quality | 5/10 | strict TS but 617 `any`, 5.6k-line pages, lint broken |
| Mobile readiness | 5/10 | Release build signed with debug key, no push, plain-text token |
| UX / design | 7/10 | New brutalist system is consistent; IA is HR-first and heavy |

### Top 10 actions (in order)

1. Add role guards to loan/shift/designation/salary-head/transaction/dashboard/billing routes (S-1…S-3). *½ day*
2. Stop serving Aadhaar/PAN/payment files from public `/uploads` (S-6). *1 day*
3. Enforce subscription status in the API (S-7) and fix WhatsApp gating (B-3). *1 day*
4. Whitelist fields on update endpoints; validate body-supplied IDs belong to the tenant (S-4, S-5). *1–2 days*
5. Add attempt lockout to phone-OTP login (S-8) and verify WhatsApp webhook signatures (S-9). *1 day*
6. `npm audit fix` backend (multer, nodemailer, axios are high) (S-16). *½ day*
7. Add the subscription-expiry + fee-reminder cron (B-1, B-2). *3–4 days*
8. Real release keystore + secure token storage on mobile (M-1, M-2). *1 day*
9. Tests on money/permission paths + CI + Sentry. *1 week*
10. Company-first indexes + paginate reports (E-1, E-2). *1–2 days*

---

## 2. Security & access control

| ID | Sev | Finding | Where | Fix |
|---|---|---|---|---|
| S-1 | **P0** | **Loan endpoints have no role check.** Router uses only `protect`; handlers never check role. An `employee`/`parent` user can create loans with arbitrary `status`/amount, **approve their own request** (`updateLoanStatus`, commented "Owner/HR"), edit, delete and bulk-import. [Confirmed] | `routes/loanRoutes.js:14-20`, `controllers/loanController.js:58, 155` | Add `authorize("super_admin","hr_manager")` to all except `GET /` and `POST /request` |
| S-2 | **P0** | Same pattern on **shifts, designations, salary heads, transactions (finance ledger)**: only `protect`, zero role checks in controllers. Any logged-in user can create/edit/delete. [Confirmed] | `routes/shiftRoutes.js`, `designationRoutes.js`, `salaryHeadRoutes.js`, `transactionRoutes.js`, `paymentMethodRoutes.js` | Owner/HR guard on writes |
| S-3 | **P1** | `GET /api/dashboard/stats` and the billing router (`subscription`, `invoices`, `create-order`, `verify-*`) are open to every role; no role check in `getStats`. A parent/employee can read company-wide stats and invoices. [Confirmed] | `controllers/dashboardController.js:12`, `routes/billingRoutes.js` | Owner guard; employees/parents get their own endpoints only |
| S-4 | **P1** | **Mass assignment on updates.** `update = { ...req.body }` passed straight to `findOneAndUpdate`; `company` is a schema field so a client can move a record to another tenant. `eventController.js:208-217` does it right (deletes `company`/`_id`) — copy that. [Confirmed] | `studentController.js:356`, `sportController.js:72`, `sportsPlanController.js:129`; creates with `...req.body`: `loanController.js:58`, `designationController.js:23`, `salaryHeadController.js:108`, `shiftController.js:13` | Pick-list of allowed fields (or strip `company`, `_id`, status/amount-type fields) |
| S-5 | **P1** | **Body-supplied IDs not checked against tenant:** loan `employee`; inventory `assignedTo` (`inventoryController.js:199-219`). Lets a user attach their records to another academy's people. (A similar gap I introduced for booking `studentId` was fixed during this audit.) [Confirmed] | `loanController.js:58`, `inventoryController.js:199` | `Model.findOne({_id, company})` before use |
| S-6 | **P0** | **Sensitive documents are publicly addressable.** `/uploads` is served by `express.static` with no auth. Aadhaar/PAN/resume files are named `${companyId}_${employeeId}_aadhaarDoc.ext`; payment screenshots/QR codes sit in the same tree. An authenticated download route exists (`employeeController.js:~654`) but the static route bypasses it. [Confirmed config, *verify* live URL] | `server.js:76-85`, `middleware/upload.js:67` | Serve private folders through an authenticated handler or signed URLs (object storage); keep only logos/avatars/event media public |
| S-7 | **P0** | **Subscription enforcement is client-side only.** The web `ProtectedRoute` redirects when the plan isn't active, but API requests are never checked (login does check the plan, so only users who are already logged in, or hold a 30-day token, slip through). `getCompanyFeatures` returns *all* features whenever a subscription document exists — expired, unpaid or trial included. A lapsed customer keeps full API + mobile access. [Confirmed] | `frontend/src/App.tsx:73-90`, `backend/utils/planFeatures.js:22-28`, `middleware/auth.js` | Add `requireActiveSubscription` middleware after `protect` (allow billing routes); make `getCompanyFeatures` check status/expiry |
| S-8 | **P1** | **Phone-OTP login has no per-account attempt limit** (2FA has one: 10 tries → 30 min lock). 6-digit code, limit is per-IP 50/15 min only → distributed brute force possible. [Confirmed no counter; *verify* OTP TTL] | `controllers/authController.js:483-600` | Count failures on the user, lock/clear OTP after 5 |
| S-9 | **P1** | **WhatsApp webhook is unauthenticated:** no `X-Hub-Signature-256` check; default verify token `"nesthr_verify_token"`; logs full headers and body (PII, tokens) with emoji debug prints. Anyone can POST fake "payslip received" events. [Confirmed] | `routes/whatsappWebhookRoutes.js:7, 33-48` | Verify HMAC with app secret, remove default token, drop body logging |
| S-10 | **P2** | **ADMS biometric endpoints identify devices by serial number only** (`/iclock/cdata`, `/getrequest`). Anyone who learns a serial can inject attendance. Inherent to the protocol — mitigate with IP allow-list per device or a secret in the registered URL. [Confirmed] | `routes/admsRoutes.js:388+` | Per-device secret / allow-list |
| S-11 | **P2** | JWT lives 30 days, no refresh/rotation; stored in `localStorage` (web) and unencrypted `AsyncStorage` (mobile). (Good: inactive users are rejected on every request.) [Confirmed] | `utils/generateToken.js:4`, `frontend/src/services/api.ts:5`, `NestSports/src/api/client.ts:1` | 15-min access + refresh token; Keychain/Keystore on mobile |
| S-12 | **P2** | `/internal/stats` and CRM use a single shared secret, accepted in the **query string** (ends up in logs) and compared with `!==`. [Confirmed] | `routes/statsRoutes.js:22` | Header only, `crypto.timingSafeEqual`, per-integration keys |
| S-13 | **P2** | Error handler returns raw `err.message` for 500s in production (can leak DB/internal messages). [Confirmed] | `middleware/errorHandler.js:30` | Generic message for 5xx in prod |
| S-14 | **P2** | Upload type check trusts the client-declared MIME in most uploaders; magic-byte check (`file-type`) exists only in one path. [Confirmed] | `middleware/upload.js:15, 75, 103, 123…` | Run content sniffing everywhere |
| S-15 | **P0 (mobile)** | **Android release is signed with the debug keystore** and the debug keystore is committed; Proguard/R8 off. Play Store will not accept it and anyone can re-sign the app. [Confirmed] | `NestSports/android/app/build.gradle:60, 104-110` | Create release keystore (CI secret), enable R8 |
| S-16 | **P1** | **Dependencies:** backend 9 vulns incl. **high: multer (uploads), nodemailer (email), axios**; web 9 incl. **high: xlsx (no fix), pdfjs-dist, nanoid, postcss**; mobile 1 high (xlsx). `npm audit fix` clears most backend ones. [Confirmed] | `package.json` ×3 | Upgrade; replace `xlsx` with `exceljs`/maintained fork |
| S-17 | **P3** | Face recognition has **no liveness check** (a printed photo can match) and depends on a Python service that is not in this repo. [Confirmed] | `services/faceService.js` | Add liveness; document/ship the service |

What is **good** here: helmet + CSP + HSTS, strict CORS in prod (fatal if `ALLOWED_ORIGINS` missing), bcrypt, hashed reset tokens, 2FA with backup codes and lockout, tenant-scoped `findOne({_id, company})` on the large majority of handlers (attendance, leave, student attendance, events, bookings are done correctly), idempotent server-side payment verification, audit log.

---

## 3. Revenue & business-logic leaks

| ID | Sev | Finding | Where |
|---|---|---|---|
| B-1 | **P0** | **No fee reminders / dues automation.** The only scheduled job in the codebase is attendance auto-mark. No overdue status, no reminder templates (WhatsApp has check-in, payslip, leave, loan, payment-verified — none for "fee due"). The brochure promises "automated fee reminders". [Confirmed] | `jobs/attendanceAutoMark.js:275`, `services/whatsappService.js` |
| B-2 | **P0** | **`autoRenew` is a flag nothing reads, and renewals never expire.** `pending_renewal` is only set when a payment is submitted (`subscriptionController.js:562`). When `renewalDate` passes the student's plan stays "active" forever. [Confirmed] | `models/StudentSubscription.js`, `subscriptionController.js` |
| B-3 | **P0** | **WhatsApp is free for every subscriber again.** `getCompanyFeatures` hard-codes `whatsapp: true` for any subscription — the same bug noted and fixed in July — while `pricing.js` sells WhatsApp as a ₹50 tier vs ₹30 base. Meta charges per conversation, so margin leaks per customer. [Confirmed] | `utils/planFeatures.js:5-28`, `utils/pricing.js` |
| B-4 | **P1** | **Pricing is described four different ways**: code ₹30/₹50 per user per month + 18% GST; mobile Billing says "₹30/student/month · WhatsApp included"; README lists Starter/Professional/Enterprise tiers; my earlier notes had ₹150/₹300 per year. Decide one model and make every surface match. [Confirmed] | `pricing.js`, `BillingScreen.tsx:129`, `README.md` |
| B-5 | **P1** | Dead plan flags: `performanceReviews`, `exitManagement`, `recruitment` exist in `ALL_FEATURES` but are never checked; only `twoFactor` and `auditLog` are enforced. [Confirmed] | `utils/planFeatures.js` |
| B-6 | **P2** | No refund / pro-rata / cancellation-credit flow (no "refund" anywhere in controllers). [Confirmed by search] | — |
| B-7 | **P2** | Brochure claims not in code: "automated fee reminders", multi-location roll-up for owners. Remove or build before sales use. | `BROCHURE.md` |

---

## 4. Backend engineering

| ID | Sev | Finding |
|---|---|---|
| E-1 | **P1** | **Almost no company-first indexes.** Every query filters by `company`, but Student, Employee, Attendance, StudentAttendance, Booking, InventoryItem, Leave, Payroll, Notification, BiometricLog, StudentSubscription, Expense have none (only unique compounds like `{studentId, company}` that can't serve `company`-only filters). Fine at 15 students, painful at 15,000. |
| E-2 | **P1** | `reportsController.js` runs 17 `.find()` calls with no limit/`lean()` and aggregates in memory — one large academy can stall the API. |
| E-3 | **P2** | `updateAttendance` loads *all* employees of the company on every edit just to check ownership (`attendanceController.js:597-601`) — use `findOne({_id, ...})` with a company join. |
| E-4 | **P1** | **Cron runs in-process** and once on startup (`attendanceAutoMark.js:275`). With 2+ instances it runs N times; when the app restarts it re-runs. Use a leader lock or an external scheduler. |
| E-5 | **P1** | **Uploads on local disk** (`backend/uploads`). Lost/inconsistent on redeploy or horizontal scale; 8 real uploaded files (avatars, a payment QR, an inventory photo) are committed to git. Move to S3/R2 and `.gitignore` the folder. |
| E-6 | **P2** | 55 `console.log` in controllers/services/routes (some dumping full payloads); no structured logging or request IDs. |
| E-7 | **P2** | Duplicated business logic: late/shift resolution is re-implemented in `admsRoutes.js:25-50` ("mirrors attendanceController"). Divergence = payroll bugs. Extract to `utils/`. |
| E-8 | **P2** | Oversized controllers: `biometricController` 1,618 lines, `subscription` 1,056, `payroll` 1,000. Hard to test or review. |
| E-9 | **P2** | `connect-timeout("30s")` answers the client but doesn't cancel the work; long report/import requests keep running. |
| E-10 | **P1** | No tests, no CI, no `.env.example`, no setup instructions in README, ~167 env var references undocumented. Onboarding another developer is currently guesswork. |
| E-11 | **P3** | Money stored as JS `Number`. Rounding is handled in `pricing.js`, but verify payroll/EMI math for paise drift. |

---

## 5. Web app (frontend/)

| ID | Sev | Finding |
|---|---|---|
| W-1 | **P1** | **Lint is broken** — `npm run lint` fails with an ESLint config-migration error, so there is effectively no static check. |
| W-2 | **P2** | `tsc --noEmit` currently reports 9 errors (e.g. `LoansPage` status type doesn't include `"pending"`/`"rejected"` — type drift hiding real bugs) and 617 uses of `any`; `services/api.ts` takes `object` bodies (99 loose types). |
| W-3 | **P1** | **React Query is installed but unused** (0 `useQuery`), and there are 0 `AbortController`s → no caching, refetch on every navigation, and stale responses can overwrite newer ones. |
| W-4 | **P1** | **Route guard checks login + subscription, not role.** An employee/parent can open `/payroll`, `/loans` etc. by URL; today only the (inconsistent) API stands between them and the data — see S-1/S-2. |
| W-5 | **P2** | `request()` has no global 401 handling (expired token only handled at first load, `AuthContext.tsx:92`) → half-working screens instead of a clean re-login. |
| W-6 | **P1** | **Performance:** one 4.6 MB JS bundle (+1.2 MB PDF worker), no `React.lazy`/route splitting. First load on slow Wi-Fi will feel broken. |
| W-7 | **P2** | **Maintainability:** `ReportsPage` 5,606 lines with 154 `useState`; `EmployeesPage` 3,998; `SettingsPage` 2,829. 1,117 hard-coded `#024BAB` instead of the Tailwind `primary` token. 206 swallowed errors (`catch {}` / `.catch(() => {})`). |
| W-8 | **P2** | **Hand-rolled modals** — 50 `fixed inset-0` overlays, 1 Escape handler, 0 `role="dialog"`/`aria-modal`: no focus trap, no keyboard close. 44 native `alert()`/`confirm()` calls break the visual system. |
| W-9 | **P2** | **Accessibility:** 384 `<label>`s but 4 `htmlFor`; 358 `outline-none`. Screen-reader and keyboard users will struggle on forms. |
| W-10 | **P2** | 23 pages render a `<table>` with no mobile card fallback (Attendance, Payroll, Leave, Loans, Reports, Biometric, …). Mobile web users get horizontal scrolling. |
| W-11 | **P3** | The new brutalist skin is applied through global CSS attribute selectors (`[class*="border-2"]`). It works and is fast to roll out, but is brittle: promote it to real components (`Card`, `Button`, `Badge`, `Modal`) and tokens over time. |
| W-12 | **P3** | `api.ts` (1,371 lines) and mobile `client.ts` (1,130 lines) are hand-written duplicates — they will drift. Generate from an OpenAPI schema or a shared types package. |

---

## 6. Mobile app (NestSports/)

| ID | Sev | Finding |
|---|---|---|
| M-1 | **P0** | Release signed with debug keystore; R8/Proguard off (S-15). |
| M-2 | **P1** | JWT in plain `AsyncStorage` (S-11) → use Keychain/Keystore. |
| M-3 | **P1** | **No push notifications** (no Firebase/Notifee). Parents only hear about check-ins/fees via paid WhatsApp. |
| M-4 | **P2** | API URL hard-coded to production (`config.ts:1`); no staging/dev switch → easy to test against live data. |
| M-5 | **P2** | No offline handling (no NetInfo, no queue). Coaches mark attendance courtside where signal is poor. |
| M-6 | **P2** | 528 `any`; only the default Jest test exists. |
| M-7 | **P2** | Photo cropping now uses a native module (`react-native-image-crop-picker`) → needs rebuild and QA on both platforms. |
| M-8 | **P3** | Billing screen shows outdated price copy (B-4); no Payment-method/crown elements (parity gap with web, intentional). |

---

## 7. UI / UX audit

**What works**
- The new neo-brutalist system (hard shadows, rounded 8px, pill status badges, KPI cards, top-aligned modals) is now consistent across web and mobile and reads as a product, not a template.
- Filters + search + sort + empty states are present on most list pages; loading uses a branded spinner.
- Parent portal is correctly simplified.

**Problems**
| ID | Sev | Finding | Suggestion |
|---|---|---|---|
| U-1 | **P1** | **Information architecture is HR-first and heavy.** The owner sidebar has ~27 items across 8 groups (Credentials, Documents, Departments, Loans, Payroll, Audit Log …) and the dashboard greets with "Here's your HR overview" and **Total Employees first**. An academy owner's questions are: *who owes me money, who's absent, who's about to leave.* | Reorder dashboard: Fees collected / Dues / Today's attendance / New enrolments. Group HR items under one "Staff & Payroll" section, collapsed by default. |
| U-2 | **P1** | Domain vocabulary is borrowed from HR: "Staff", "Departments", "Credentials", model named `Employee`. There is no **Batch** object (it's a free-text field), so capacity, timetable, coach-per-batch and attendance-by-batch are impossible. | Introduce `Batch` (sport, coach, days/time, capacity, fee). |
| U-3 | **P2** | Native `alert()/confirm()` (44) and 50 different modal implementations → inconsistent look, no Esc/focus. | One `<Modal>` + one `<ConfirmDialog>` component. |
| U-4 | **P2** | Forms mostly validate on submit (toast) rather than inline per field. | Inline errors + disabled-until-valid on the long forms (Student, Staff, Event). |
| U-5 | **P2** | Onboarding exists (company → import → plan → pay) but no sample data or "first 5 things" checklist; first value (a marked attendance + a paid fee) is several screens away. | Add a checklist card on the dashboard + a demo-data toggle. |
| U-6 | **P2** | English only. Target users (Indian academies, parents on WhatsApp) will want Hindi/regional parent-facing messages and UI. | i18n for parent surfaces first. |
| U-7 | **P3** | Mobile web (browser) users get dense tables (W-10); the native app is good but web on phones is not. | Card fallback component for tables. |

---

## 8. Product audit

### Best (keep and market)
- **Attendance by face, GPS, biometric device/RFID, manual** — feeds payroll and parent alerts automatically.
- **Parent-linked students with phone-OTP login** — frictionless for parents.
- **Events/tournament engine** — config-driven; new event types are one line.
- **WhatsApp as a first-class channel** (payslips, check-ins, receipts) — if monetised correctly (B-3).
- **Multi-tenant SaaS with GST-aware pricing and offer codes.**
- **Excel import/export** across modules — eases migration from spreadsheets.
- **Web + mobile parity** is actively maintained.

### Add (priority order)
1. **Fee dues engine**: due dates, overdue status, aging report, WhatsApp/push reminders, grace rules. *(Revenue protector — B-1/B-2.)*
2. **Subscription lifecycle job**: auto-expire, `pending_renewal`, renewal reminders, auto-renew for gateways that support mandates.
3. **Batch object + timetable + capacity**, trial classes, waitlist.
4. **Admissions funnel**: public enquiry/trial form → pipeline → enrol (today's "CRM" is internal offer-code tooling, not an academy lead pipeline).
5. **Student progress**: assessments, skill levels, report card/certificate PDF (strongest parent-retention lever).
6. **Mobile push** + notification preferences per parent.
7. **Owner analytics**: collection rate, churn risk (attendance drop), revenue per batch/coach, new vs renewed.
8. **Sibling/family discounts, pro-rata joins, refunds.**
9. **Privacy for minors (DPDP)**: consent capture, data export/delete, retention policy.
10. **Multi-branch owner view**, coach payout/commission, offline attendance on mobile, Hindi/regional UI.

### No need / cut / hide
- **Extra payment gateways.** Razorpay, HDFC, Cashfree, PhonePe, Paytm all exist in code. Keep Razorpay (+ one backup); each extra rail is permanent support and security surface.
- **HR-only extras for academy buyers** — cheque/payslip designer, offer-letter templates, recruitment/exit/performance flags. Hide behind an "Academy" vs "Academy + HR" switch rather than deleting.
- **More report types and more event types.** Reports are 5.6k lines already and the event engine is ahead of usage; invest in the dashboard (U-1) instead.
- **Any new module before items 1–5 of the Top-10 list are done.**

### KPIs to instrument (none are tracked today)
Time-to-first-attendance, time-to-first-paid-fee, fee collection rate (on-time %), weekly active parents, attendance marked per coach per day, WhatsApp cost per active student, monthly logo churn, support tickets per 100 students.

---

## 9. Process & DevEx

- No automated tests anywhere (only the RN template test). Highest-value first tests: `calculatePricing`, payment verify idempotency, subscription expiry job, role guards (a table-driven test that hits every route as employee/parent and expects 403), tenant isolation (user A cannot read/write user B's records), booking stock deduction/return.
- No CI; no `.env.example`; README has no setup/run section; branding leftovers (`nesthr.png`, `hrms_token`, `Employee` model, `iss: "nesthr-platform"`).
- No error monitoring (Sentry), no uptime/health beyond a static `/api/health`, no DB backup policy documented.
- Git hygiene: user uploads and a 6 MB model binary are in the repo; `.gitignore` at root is minimal.

---

## 10. Suggested roadmap

**Week 1 — close the holes (≈4–5 dev-days)**
S-1, S-2, S-3, S-4, S-5, S-6, S-7, S-8, S-9, S-16, B-3, S-15 (release keystore), W-4 role-aware route guard.

**Weeks 2–4 — protect revenue & stabilise (≈2 weeks)**
B-1 + B-2 (dues + expiry cron, reminders), pricing single source of truth (B-4), tests for the guard/tenant/pricing/payment paths + CI, Sentry, S3/R2 uploads (E-5), company-first indexes (E-1), paginate reports (E-2), web code-splitting (W-6), mobile Keychain + push (M-2, M-3), working ESLint (W-1).

**Months 2–3 — academy depth**
Batch/timetable/capacity, admissions funnel, student progress & certificates, owner analytics dashboard, shared Modal/Confirm components, accessibility pass, Hindi parent UI, DPDP consent/export.

---

## 11. Verification commands (so you can re-check any finding)

```bash
# S-1/S-2: routers with no role guard
grep -n "authorize" backend/routes/loanRoutes.js backend/routes/shiftRoutes.js backend/routes/designationRoutes.js backend/routes/salaryHeadRoutes.js backend/routes/transactionRoutes.js   # → no matches
# S-6: public static uploads
sed -n 76,85p backend/server.js
# S-7 / B-3
sed -n 5,28p backend/utils/planFeatures.js
# B-1: only cron
grep -rn "cron.schedule" backend --include=*.js --exclude-dir=node_modules
# E-1: company-first indexes
grep -n "index(" backend/models/Student.js backend/models/Employee.js backend/models/Attendance.js
# S-16
(cd backend && npm audit --omit=dev); (cd frontend && npm audit --omit=dev); (cd NestSports && npm audit --omit=dev)
# W-1
(cd frontend && npm run lint)
```
