# NestPlay / Sports Pixelate — Cybersecurity, Bug, Dead-code & Performance Audit (re-audit)

Scope: `backend/` (Express + Mongoose, multi-tenant), `frontend/` (React/Vite), `NestSports/` (mobile — auth client only).
This is a **re-audit of the code as it is today**. The older `SECURITY_AUDIT.md` / `AUDIT_REPORT.md` were used as a checklist: I re-verified each of their findings in code first (§2), then looked for what they did not cover. Method: manual review of auth / billing / upload / webhook paths, route-guard map, ESLint / tsc / orphan / N+1 scans, `npm audit`, offline proof tests (stubbed models — **no request to any live system, the live database was never touched**). Pre-change snapshot: `scratchpad/backups/sports-pre-audit.tgz`. Nothing was committed.

## 1. Summary

| Area | Findings | Fixed now | Left (needs your decision) |
|---|---|---|---|
| Security | 11 new | 10 | 1 |
| Bugs | 3 | 3 | 0 |
| Dead / extra code | 5 | 4 | 1 |
| Performance | 6 | 5 | 1 |

The earlier audit's criticals (C-1 upload-guard bypass, C-2 operator injection, C-3 cross-tenant account link on create, H-1/H-2 employee data exposed to parents, H-3 print XSS in reports, H-4 fee-payment roles) **are already fixed in code** — see §2. What was still open: session revocation, the 2FA step, one remaining account-link path, billing replay, active-content uploads, plus performance.

## 2. Previously reported items — status in today's code

| Old ID | Item | Status |
|---|---|---|
| C-1 | `/uploads` identity-folder guard bypass | **Fixed** — `uploadGuard` resolves/decodes the path before judging the folder |
| C-2 | `$ne` operator injection into device lookups | **Fixed** — `sanitizeInput` strips `$` keys; device token/SN are type-checked |
| C-3 | cross-academy link + password reset | **Fixed in `createEmployee` and `resetEmployeePassword`; bulk import was still open → fixed now (S-3)** |
| H-1 / H-2 | employee directory / vault / leave exposed to parents | **Fixed** — `NON_PARENT` route guards + `DIRECTORY_FIELDS` projection |
| H-3 | print-window XSS | **Partly** — values were escaped, but windows had no CSP and used inline `<script>` → fixed now (S-6) |
| H-4 | fee-payment verify/cancel by any staff | **Fixed** (route guards) |
| M-1 | no JWT revocation | **Open → fixed now (S-1)** |
| M-2 | upload extension from client name | **Open → fixed now (S-5)** |
| M-3 | cross-tenant `verifyPayment` | **Open → fixed now (S-4/S-7)** |
| M-4 | admin-set passwords min 6 | still min 6 on admin-set paths (employee create/import) — **left**, see §6 |
| M-6 | unescaped regex | **Mostly fixed**; two leftovers (`reports`, `audit`) fixed now |
| M-7 | rate-limit gaps on `/iclock`, `/api/crm`, webhook | **Left** — device traffic shares IPs; needs per-device quotas |
| M-8 | dependencies | partly, see §5 |

## 3. New findings

### Security
| ID | Sev | Finding | Status |
|---|---|---|---|
| S-1 | High | **No session revocation.** A 30-day bearer token survived password change/reset (the earlier M-1). | Fixed — `tokenVersion` bumped in the `User` pre-save hook on **every** password write (self change, reset by e-mail / WhatsApp / TOTP, admin reset, parent/student guardian edit); `protect` refuses stale tokens; HS256 pinned |
| S-2 | High | **2FA step started from a bare user id.** `/auth/2fa/verify` took `{ userId, token }`: anyone who knew a user id (they leak through the API) could brute-force the 6-digit code without the password. | Fixed — login returns a 5-minute signed pending token in the same `userId` field (web and mobile clients keep working unchanged); `protect` refuses any token with a `purpose` claim |
| S-3 | High | **Account takeover through bulk employee import**: an existing login of *any* academy (incl. an owner) was adopted by the new employee row (the create path was fixed, the import path was not). | Fixed |
| S-4 | High | **Subscription payment replay.** Razorpay/HDFC signatures never expire; re-posting an old `(orderId, paymentId, signature)` re-activated an expired plan for free, duplicated invoices and inflated offer-code usage. The renewal path also did not check that the order belonged to the caller's academy. | Fixed — already-completed orders return "already processed"; ownership checked |
| S-5 | High | Uploads: extension taken from the client file name while the filter trusts the client MIME (`image/*`) ⇒ `x.html` sent as `image/png` stored in a public folder and rendered from the API origin. | Fixed — extension comes from the verified MIME (`safeExt`); `/uploads` sends `nosniff` and forces download for `.html/.svg/.xml/.js` already on disk |
| S-6 | Med | Print / PDF windows (invoice, salary slips, reports) had no CSP and inline `window.print()` scripts; one injected field = script access to `localStorage` token. | Fixed — `lib/printWindow.ts` injects `script-src 'none'`, printing is opener-driven |
| S-7 | Med | Student-fee `verifyPayment` looked the order up across all academies. | Fixed — scoped to the caller's academy |
| S-8 | Med | No per-account login lockout; unknown e-mail answered faster than a wrong password; "deactivated" revealed before the password. | Fixed — 10 failures ⇒ 15-min lock, dummy bcrypt compare, status checked after the password |
| S-9 | Med | `/internal/stats` accepted the secret in `?key=` (logs/history). Access log (`morgan dev`) printed full URLs incl. `?token=` of payment-proof images. | Fixed — header only; log prints the path without the query string |
| S-10 | Low | bcrypt cost 10. | Fixed — 12 (existing hashes keep working) |
| S-11 | Low | ADMS devices authenticate by serial number only (guessable); no per-device secret. | **Left** — needs a device-side setting |

### Bugs
| ID | Finding | Status |
|---|---|---|
| B-1 | Invoice numbers came from `countDocuments()+1` — two payments at once get the same number (3 places). | Fixed — atomic counter (`models/Counter.js`, seeded from the current count) |
| B-2 | `authController` exported `selectAcademy/listAcademies/switchAcademy` twice (duplicate keys). | Fixed |
| B-3 | `reportsController` search built `new RegExp(userInput)` — invalid input (`(`) threw a 500. | Fixed (escaped) |

### Dead / extra code
| ID | Finding | Status |
|---|---|---|
| D-1 | 13 unused npm packages in `frontend` (11 `@radix-ui/*`, `date-fns`, `sonner`) | Removed |
| D-2 | ≈ 40 unused imports across pages (ESLint autofix); `tsc --noUnusedLocals`: 69 → 33 | Removed |
| D-3 | 10 unused backend variables/functions/imports (`MONTHS`, `fmt`, `fmtNum`, `validateMongoId`, …) | Removed |
| D-4 | Duplicate exports in `authController` | Removed |
| D-5 | 33 unused props/locals left in the frontend; 14 exported-but-unreferenced helpers; 7 empty `catch {}` | Left |

### Performance
| ID | Finding | Status |
|---|---|---|
| P-1 | Entry bundle **4,747 kB** (50 pages imported eagerly). | Fixed — `React.lazy` per route: **333 kB** (gzip 1,317 → 102 kB) |
| P-2 | Payroll run: 4 queries per employee. | Fixed — 4 per run; **differential test: identical payroll rows, loan and transaction updates** |
| P-3 | Nightly attendance auto-mark: 1–2 queries per employee. | Fixed — 2 per academy |
| P-4 | Department / designation headcounts: 1 query per row. | Fixed — one aggregation |
| P-5 | No response compression. | Fixed — `compression` (new dependency) |
| P-6 | 84 `find()` without `.limit()`; 23 awaits in loops (booking, student import, event fixtures, payment links…). | Left — needs pagination / `bulkWrite` per screen |

## 4. Remediation log — applied 2026-10-17

### Verification (re-runnable, offline)

| Check | Result |
|---|---|
| `npm test` (existing 19 + new `tests/hardening.test.js`, 3 cases) | **22 / 22 pass** — stale/purpose/foreign tokens refused by `protect`; bare user id rejected by the 2FA step; `x.html` as `image/png` stored as `.png` |
| load test: `require` of every controller / route / middleware / service / job / util / model | 0 failures |
| payroll differential test (old `processPayroll` from the backup vs the batched one, same in-memory data) | identical output |
| frontend `tsc -p tsconfig.app.json` | 0 errors (before and after) |
| `vite build` | ok; entry chunk 4,747 kB → 333 kB |
| `npm audit` | backend 5 → 4, frontend 13 → 12 |

### Phase 1 — access control
S-3 (bulk import), S-7 (student-fee verify scope), S-4 ownership check.

### Phase 2 — authentication & sessions
S-1 `tokenVersion` (+ fresh token returned by `PUT /auth/profile` on a self password change; web `authAPI.updateProfile` and mobile `authAPI.updateProfile` store it), S-2 signed pending token, S-8 lockout/timing/enumeration, S-10 bcrypt 12.

### Phase 3 — exposure, uploads, XSS, billing
S-5 (`safeExt`, nosniff, download-only active content), S-6 (print CSP), S-4 (replay guard), S-9, B-1.

### Phase 4 — dependencies ✅ (partly)
`npm audit fix` (no `--force`): backend critical `proxy-addr` fixed; frontend `fast-glob`, `source-map-js` etc. **Left:** `xlsx` (no npm fix — use the SheetJS CDN tarball), `file-type` (ESM-only major), `nodemon`/`braces`/`chokidar` (dev only), `tailwindcss`/`vite` toolchain (build-time), and the **mobile app: 58 findings, almost all React-Native build tooling** — needs an RN upgrade, not a patch.

### Phase 5–7 — bugs, dead code, performance
As listed in §3.

### Rollout notes
1. **Deploy backend, web and mobile together.** The 2FA field is still called `userId`, so old clients keep working, but a client that cached a login response from before the deploy gets "Login step expired" and must sign in again.
2. Existing sessions keep working until the user's next password change; users who change their own password get a fresh token automatically.
3. `/internal/stats` must be called with the `X-Stats-Key` header.
4. New collection `counters` (created on first use; seeded from the current invoice count) and new `User` fields — no migration. Run `npm install` in `backend/` (adds `compression`) and `frontend/` (removed packages).
5. Old `.html/.svg` files already in `uploads/` now download instead of rendering — review and delete any you did not upload.
6. The repo already had 400+ uncommitted changes before this audit; review `git diff` per file when committing.

## 5. Left for you (decisions)
- **Admin-set passwords** (employee create/import: min 6, no complexity) — raising it to the 8-char letter+digit rule used elsewhere changes the create-employee UX; say the word and it is a 3-line change.
- **ADMS per-device secret** (S-11) and **rate limits for `/iclock` / `/api/crm`** (M-7) — need device-side configuration.
- **Pagination** for the 84 unbounded lists and `bulkWrite` for the loop-writes (P-6).
- **xlsx**, `file-type` major, React-Native toolchain upgrade.
