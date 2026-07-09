# NestSports

**The all-in-one management platform for sports academies.**

NestSports brings together staff/HR management, coaching operations, student enrollment, facility bookings, billing, and payments into a single system — built for sports academies, coaching centers, and training institutes that currently juggle spreadsheets, WhatsApp groups, and paper registers.

---

## Who It's For

- **Academy Owners / Admins** — run the whole business: staff, coaches, students, finances, and facilities from one dashboard.
- **Coaches / Staff** — clock in/out, view payslips, apply for leave, request advances, and manage their own documents.
- **Parents** — track their child's attendance, subscription status, and facility bookings from a dedicated portal.

---

## Core Feature Areas

### 1. Staff & HR Management

- Complete employee directory — onboarding, profiles, departments, designations, deactivation
- **Bulk Excel import/export** of employee records
- **Face-recognition attendance** — webcam-based check-in/out matched against enrolled face data
- **Fingerprint/biometric enrollment** for device-based verification
- **Geofenced attendance** — GPS-verified check-in/out with distance-from-site flagging
- **Automated daily attendance marking** — present/late/absent computed automatically from shift timings, holidays, and approved leave
- **Attendance correction requests** with admin approval workflow
- **Leave management** — apply, approve/reject, half-day (AM/PM) support, automatic email alerts
- **Loans & salary advances** — staff self-service requests with admin tracking and approval
- **Payroll processing** — configurable salary components and deduction rules, monthly payroll runs, auto-generated **PDF payslips**
- **WhatsApp payslip delivery** — payslips sent via WhatsApp with interactive "Received / Not Received" buttons that auto-update delivery status
- **Document vault** — secure, categorized storage for IDs, contracts, certificates, resumes, and offer letters
- **Offer letter templates** and configurable shift timings, holiday calendars, and role permissions
- **Two-factor authentication (2FA)** with backup codes and phone OTP, plus automatic lockout on repeated failed attempts
- **Audit log** of all administrative actions
- **Internal support ticketing** for staff issue tracking

### 2. Student & Academy Management

- Student enrollment with sport, batch, assigned coach, and linked parent/guardian accounts
- **Coaching plans** — define sport-specific plans with sessions-per-week and monthly/yearly pricing
- **Student subscriptions** — enroll, renew, or cancel a student's plan, fully tied to payments
- **Student attendance tracking**, separate from staff attendance
- **Facility booking system** — reserve courts, grounds, or pools by date and time slot with automatic fee calculation
- **Facilities management** — configure bookable venues and hourly rates
- **Equipment & inventory tracking** — stock levels and check-in/check-out transaction history
- **Expense tracking** for day-to-day academy costs

### 3. Parent Portal

- A dedicated, simplified view for parents to check their child's attendance, active subscription, and upcoming/past facility bo₹okings — no admin clutter, just what matters to them.

### 4. Payments & Billing

- **Razorpay** integration for plan checkout, subscription billing, and facility booking payments
- **HDFC payment gateway** as a secondary payment rail
- Discount/offer code support at checkout
- Auto-generated invoices and payment success/failure confirmation pages
- Reliable payment reconciliation for async/pending transactions

### 5. Notifications

- **WhatsApp** notifications for payslips and payment confirmations, with delivery read-receipts
- **Email** notifications for leave status, password resets, and subscription confirmations
- **Web push** notifications direct to the browser
- **In-app announcements** for academy-wide communication

### 6. Reporting & Insights

- A dedicated reporting suite covering HR, attendance, payroll, and financial data — with **Excel export**
- Dashboard KPIs — headcount, today's attendance, attendance-rate trends, and monthly revenue at a glance
- Individual staff-level personal reports

### 7. Built for Growing Academies (SaaS Platform)

- Tiered subscription plans — **Starter, Professional, and Enterprise** — each with its own employee limits and feature set
- Feature-gated access so academies only pay for what they use, with a clear upgrade path
- Guided onboarding wizard — company setup → initial staff import → plan selection → payment, in a few guided steps
- Multi-tenant architecture designed to serve many academies independently and securely

---

## Roles at a Glance

| Role                         | What They Can Do                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------- |
| **Owner / Admin**            | Full control — staff, students, payroll, finances, facilities, reports, settings |
| **HR Manager / Executive**   | Delegated HR operations — attendance, leave, payroll, documents                  |
| **Coach / Staff (Employee)** | Self-service — clock in/out, payslips, leave, loans, own documents               |
| **Parent**                   | View-only portal — child's attendance, subscription, and bookings                |

---

## Technology

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, MongoDB
- **Payments**: Razorpay, HDFC Payment Gateway
- **Biometrics**: Face recognition, fingerprint/device enrollment
- **Communication**: WhatsApp Business API, email, web push notifications
- **Security**: JWT authentication, two-factor authentication, geofencing, audit logging
