# NestSports — WhatsApp Message Templates

Checklist for setting up the **new NestSports WhatsApp Business number**. Every
template below must exist and be **Approved** in Meta Business Manager
(WhatsApp Manager → Account tools → Message templates) under the WABA that
owns the new number, using the **exact name and variable count** shown —
`backend/services/whatsappService.js` calls these by name, so a mismatch means
silent delivery failure (check server logs for `[WA-DEBUG]` / `[WhatsApp]`
errors).

> Once created, set `META_WA_TOKEN` and `META_WA_PHONE_ID` (and
> `META_WA_VERIFY_TOKEN` for the webhook) in `.env` to point at the new
> number. No code changes are needed if you keep the names exactly as listed.

Progress: **`0` / `18`** created — tick each box off as you submit it.

---

## Legend

- **Category** — Meta template category (Utility / Authentication).
- **Params** — positional `{{n}}` body variables, in the order the code sends them.
- ✅ = template's body/structure is carried over from the old NestHR number, now recreated under `nestsports_*` names — you can duplicate/export it from the old WABA if Meta allows, otherwise re-create with identical text.
- 🆕 = brand-new template, not present on the old number.

---

## 1. Attendance — staff

### [ ] `nestsports_checkin` ✅

- **Category:** Utility
- **Body:** `Hi {{1}}, your Check-In at {{2}} was recorded at {{3}}. Have a productive day!`
- **Params:** `firstName`, `locationName`, `time`
- **Sample:** `Rohan` · `Andheri Sports Complex` · `9:02 AM`

### [ ] `nestsports_checkout` ✅

- **Category:** Utility
- **Body:** `Hi {{1}}, your Check-Out at {{2}} was recorded at {{3}}. Total hours: {{4}}.`
- **Params:** `firstName`, `locationName`, `time`, `workHours`
- **Sample:** `Rohan` · `Andheri Sports Complex` · `6:15 PM` · `8.2h`

### [ ] `nestsports_checkin_hr` ✅

- **Category:** Utility
- **Body:** `Employee {{1}} (ID: {{2}}) checked in at {{3}} at {{4}}.`
- **Params:** `empName`, `empId`, `locationName`, `time`
- **Sample:** `Rohan Mehta` · `EMP-014` · `Andheri Sports Complex` · `9:02 AM`

### [ ] `nestsports_checkout_hr` ✅

- **Category:** Utility
- **Body:** `Employee {{1}} (ID: {{2}}) checked out at {{3}} at {{4}}. Total hours: {{5}}.`
- **Params:** `empName`, `empId`, `locationName`, `time`, `workHours`
- **Sample:** `Rohan Mehta` · `EMP-014` · `Andheri Sports Complex` · `6:15 PM` · `8.2h`

### [ ] `nestsports_attendance_status` ✅

- **Category:** Utility
- **Body:** `Hi {{1}}, your attendance for {{2}} has been marked as *{{3}}*.`
- **Params:** `firstName`, `date` (DD/MM/YYYY), `statusLabel` (one of: `Present`, `Absent`, `Late`, `Half Day`)
- **Sample:** `Rohan` · `18/07/2026` · `Present`
- Note: one template covers all four statuses; holiday/weekend/on-leave don't trigger it.

---

## 2. Attendance — student / guardian 🆕

### [ ] `nestsports_student_checkin` 🆕

- **Category:** Utility
- **Body:** `Hi {{1}}, {{2}} checked in at {{3}} at {{4}}.`
- **Params:** `guardianName`, `studentName`, `locationName`, `time`
- **Sample:** `Priya` · `Aarav Sharma` · `Andheri Sports Complex` · `4:05 PM`

### [ ] `nestsports_student_checkout` 🆕

- **Category:** Utility
- **Body:** `Hi {{1}}, {{2}} checked out at {{3}} at {{4}}.`
- **Params:** `guardianName`, `studentName`, `locationName`, `time`
- **Sample:** `Priya` · `Aarav Sharma` · `Andheri Sports Complex` · `6:00 PM`

---

## 3. Leave

### [ ] `nestsports_leave_submitted` ✅

- **Category:** Utility
- **Body:** `Hi {{1}}, your {{2}} leave request from {{3}} to {{4}} for {{5}} day(s) has been submitted and is awaiting approval from your manager.`
- **Params:** `firstName`, `leaveType`, `startDate`, `endDate`, `days`
- **Sample:** `Rohan` · `Sick` · `20/07/2026` · `21/07/2026` · `2`

### [ ] `nestsports_leave_approved` ✅

- **Category:** Utility
- **Body:** `Hi {{1}}, your {{2}} Leave ({{3}} to {{4}}, {{5}} day(s)) has been APPROVED.`
- **Params:** `firstName`, `leaveType`, `startDate`, `endDate`, `days`
- **Sample:** `Rohan` · `Sick` · `20/07/2026` · `21/07/2026` · `2`

### [ ] `nestsports_leave_rejected` ✅

- **Category:** Utility
- **Body:** `Hi {{1}}, your {{2}} Leave request has been REJECTED. Reason: {{3}}.`
- **Params:** `firstName`, `leaveType`, `reason`
- **Sample:** `Rohan` · `Sick` · `Insufficient balance`

### [ ] `nestsports_leave_request_hr` ✅

- **Category:** Utility
- **Body:** `New Leave Request — Employee: {{1}} ({{2}}), Type: {{3}}, Dates: {{4}} to {{5}} ({{6}} day(s)), Reason: {{7}}.`
- **Params:** `empName`, `empId`, `leaveType`, `startDate`, `endDate`, `days`, `reason`
- **Sample:** `Rohan Mehta` · `EMP-014` · `Sick` · `20/07/2026` · `21/07/2026` · `2` · `Fever`

---

## 4. Payroll

### [ ] `nestsports_salary_paid` ✅ (complex)

- **Category:** Utility
- **Header:** Type `DOCUMENT` (payslip PDF attached at send time)
- **Body:**

  ```
  Hi {{1}}, your salary for *{{2}}* has been credited! 🎉

  💰 *Salary Breakdown*
  ━━━━━━━━━━━━━━━━━━━━━
  Basic Salary  : {{3}}
  Allowances    : {{4}}
  Overtime      : {{5}}
  Gross Salary  : {{6}}
  ━━━━━━━━━━━━━━━━━━━━━
  Deductions    : -{{7}}
  *Net Pay      : {{8}}*
  ━━━━━━━━━━━━━━━━━━━━━
  📅 Present : {{9}} / {{10}} days
  💳 Mode    : {{11}}
  🗓 Paid On : {{12}}
  ```

- **Footer:** `NestSports — Pixelate Nest`
- **Buttons:** 2× Quick Reply — `✅ Received` / `❌ Not Received`
- **Params (12):** `firstName`, `period`, `basicSalary`, `allowances`, `otPay`, `grossSalary`, `totalDeductions`, `netSalary`, `presentDays`, `workingDays`, `paymentMode`, `paidOn`
- **Sample:** `Rohan` · `June 2026` · `₹40,000` · `₹5,000` · `₹1,200` · `₹46,200` · `₹2,000` · `₹44,200` · `26` · `27` · `Bank Transfer` · `01/07/2026`

---

## 5. Loans / Advances

### [ ] `nestsports_loan_submitted` ✅

- **Category:** Utility
- **Body:** `Hi {{1}}, your {{2}} request of ₹{{3}} ({{4}} month(s) tenure) has been submitted and is awaiting approval.`
- **Params:** `firstName`, `label` (`Loan` or `Salary Advance`), `amount`, `tenureMonths`
- **Sample:** `Rohan` · `Loan` · `50000` · `6`

### [ ] `nestsports_loan_approved` ✅

- **Category:** Utility
- **Body:** `Hi {{1}}, your {{2}} request of ₹{{3}} has been APPROVED. Monthly EMI: ₹{{4}}.`
- **Params:** `firstName`, `label`, `amount`, `monthlyEmi`
- **Sample:** `Rohan` · `Loan` · `50000` · `8500`

### [ ] `nestsports_loan_rejected` ✅

- **Category:** Utility
- **Body:** `Hi {{1}}, your {{2}} request of ₹{{3}} has been REJECTED. Reason: {{4}}.`
- **Params:** `firstName`, `label`, `amount`, `reason`
- **Sample:** `Rohan` · `Loan` · `50000` · `Exceeds eligible limit`

### [ ] `nestsports_loan_request_hr` ✅

- **Category:** Utility
- **Body:** `New {{1}} Request — Employee: {{2}} ({{3}}), Amount: ₹{{4}}, Tenure: {{5}} month(s), Reason: {{6}}.`
- **Params:** `label`, `empName`, `empId`, `amount`, `tenureMonths`, `reason`
- **Sample:** `Loan` · `Rohan Mehta` · `EMP-014` · `50000` · `6` · `Medical expense`

---

## 6. Auth & Billing (no per-company gate)

### [ ] `nestsports_otp` ✅

- **Category:** **Authentication** (Meta treats OTP templates as a distinct category with mandatory copy-code button — do not use Utility for this one)
- **Body:** `{{1}} is your NestSports login OTP. It expires in 10 minutes. Do not share this code.`
- **Button:** 1× URL/OTP copy-code button, parameter = the OTP
- **Params:** `otp`
- **Sample:** `482913`
- Used for **all** phone logins — staff, coaches, and parents alike (same OTP flow, role-agnostic).

### [ ] `nestsports_subscription` ✅

- **Category:** Utility
- **Body:** `Welcome {{1}}! Your {{2}} plan for {{3}} is active. Amount: {{4}}, Renewal: {{5}}. Login: {{6}}`
- **Params:** `toName`, `planName`, `companyName`, `amount`, `renewalDate`, `dashboardUrl`
- **Sample:** `Priya` · `Pro` · `Ace Sports Academy` · `₹15,000` · `18/07/2027` · `https://app.nestsports.in`

---

## Notes

All template names in `backend/services/whatsappService.js` now use the
`nestsports_*` prefix (previously `neshr_*`, carried over from NestHR) — code
and this README are in sync. If you rename any template again, update both
the Meta template name **and** the matching `sendTemplate(phone,
"nestsports_...", ...)` call site in `whatsappService.js` together, or sends
will silently fail.
