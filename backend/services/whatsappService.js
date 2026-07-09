const https = require("https");
const FormData = require("form-data");
const Setting = require("../models/Setting");
const { getCompanyFeatures } = require("../utils/planFeatures");

// ─── Internal: upload a buffer to Meta Media API → returns media_id ──────────

async function uploadMediaToMeta(
  buffer,
  filename = "payslip.pdf",
  mimetype = "application/pdf",
) {
  const accessToken = process.env.META_WA_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_ID;
  if (!accessToken || !phoneNumberId) return null;

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", buffer, { filename, contentType: mimetype });
  form.append("type", mimetype);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "graph.facebook.com",
        path: `/v20.0/${phoneNumberId}/media`,
        method: "POST",
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${accessToken}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300)
              resolve(json.id || null);
            else {
              console.error("[WA-DEBUG] Media upload failed:", data);
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on("error", (e) => {
      console.error("[WA-DEBUG] Media upload error:", e.message);
      resolve(null);
    });
    form.pipe(req);
  });
}

// ─── Internal: send a Meta template message ──────────────────────────────────

// extraComponents: optional array of button/header components to append
async function sendTemplate(
  phone,
  templateName,
  params,
  lang = "en",
  extraComponents = [],
) {
  const accessToken = process.env.META_WA_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_ID;
  console.log(
    `[WA-DEBUG] sendTemplate → phone=${phone} template=${templateName} META_WA_TOKEN=${accessToken ? "SET" : "MISSING"} META_WA_PHONE_ID=${phoneNumberId ? "SET" : "MISSING"}`,
  );
  if (!accessToken || !phoneNumberId) {
    console.warn(
      "[WA-DEBUG] ABORT: META_WA_TOKEN or META_WA_PHONE_ID not set in .env",
    );
    return;
  }

  let toNumber = phone.replace(/^\+/, "").replace(/\s/g, "");
  // Auto-add India country code for bare 10-digit numbers
  if (/^[6-9]\d{9}$/.test(toNumber)) toNumber = "91" + toNumber;

  const components = [
    {
      type: "body",
      parameters: params.map((v) => ({ type: "text", text: String(v) })),
    },
    ...extraComponents,
  ];

  const body = JSON.stringify({
    messaging_product: "whatsapp",
    to: toNumber,
    type: "template",
    template: {
      name: templateName,
      language: { code: lang },
      components,
    },
  });

  await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "graph.facebook.com",
        path: `/v20.0/${phoneNumberId}/messages`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${accessToken}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300)
            resolve(JSON.parse(data));
          else reject(new Error(`Meta API ${res.statusCode}: ${data}`));
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── Internal: check company WhatsApp gate ────────────────────────────────────

async function getCompanySetting(eventKey, companyId) {
  if (!companyId) {
    console.warn(`[WA-DEBUG] getCompanySetting: companyId is null/undefined`);
    return null;
  }
  const features = await getCompanyFeatures(companyId);
  if (!features.whatsapp) {
    console.warn(
      `[WA-DEBUG] getCompanySetting: plan does not include whatsapp for company=${companyId}`,
    );
    return null;
  }
  const setting = await Setting.findOne({ company: companyId }).select(
    `whatsappEnabled whatsappLang ${eventKey}`,
  );
  if (!setting) {
    console.warn(
      `[WA-DEBUG] getCompanySetting: no Setting doc found for company=${companyId}`,
    );
    return null;
  }
  if (!setting.whatsappEnabled) {
    console.warn(
      `[WA-DEBUG] getCompanySetting: whatsappEnabled=false for company=${companyId} — enable it in Settings`,
    );
    return null;
  }
  if (eventKey && setting[eventKey] === false) {
    console.warn(
      `[WA-DEBUG] getCompanySetting: ${eventKey}=false for company=${companyId} — disabled in Settings`,
    );
    return null;
  }
  console.log(
    `[WA-DEBUG] getCompanySetting: OK — whatsappEnabled=true, ${eventKey}=${setting[eventKey]}`,
  );
  return setting;
}

// ─── Attendance ───────────────────────────────────────────────────────────────

/**
 * Template: neshr_checkin
 * Body:  Hi {{1}}, your Check-In at {{2}} was recorded at {{3}}. Have a productive day!
 */
async function sendCheckIn(
  phone,
  { firstName, locationName, time },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyCheckIn", companyId);
    if (!s) return;
    const t = new Date(time).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
    await sendTemplate(
      phone,
      "neshr_checkin",
      [firstName, locationName, t],
      s.whatsappLang || "en",
    );
    console.log(`[WA-DEBUG] ✅ Staff check-in message DELIVERED to ${phone}`);
  } catch (err) {
    console.error(
      `[WA-DEBUG] ❌ Staff check-in FAILED to ${phone}:`,
      err.message,
    );
  }
}

/**
 * Template: neshr_checkout
 * Body:  Hi {{1}}, your Check-Out at {{2}} was recorded at {{3}}. Total hours: {{4}}.
 */
async function sendCheckOut(
  phone,
  { firstName, locationName, time, workHours },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyCheckIn", companyId);
    if (!s) return;
    const t = new Date(time).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
    const hrs = workHours ? `${Number(workHours).toFixed(1)}h` : "-";
    await sendTemplate(
      phone,
      "neshr_checkout",
      [firstName, locationName, t, hrs],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendCheckOut:", err.message);
  }
}

// ─── Leave ────────────────────────────────────────────────────────────────────

/**
 * Template: neshr_leave_submitted
 * Body:  Hi {{1}}, your {{2}} leave request from {{3}} to {{4}} for {{5}} day(s) has been submitted and is awaiting approval from your manager.
 */
async function sendLeaveSubmitted(
  phone,
  { firstName, leaveType, startDate, endDate, days },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyLeave", companyId);
    if (!s) return;
    const type = leaveType.charAt(0).toUpperCase() + leaveType.slice(1);
    const from = new Date(startDate).toLocaleDateString("en-IN");
    const to = new Date(endDate).toLocaleDateString("en-IN");
    await sendTemplate(
      phone,
      "neshr_leave_submitted",
      [firstName, type, from, to, String(days)],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendLeaveSubmitted:", err.message);
  }
}

/**
 * Template: neshr_leave_approved
 * Body:  Hi {{1}}, your {{2}} Leave ({{3}} to {{4}}, {{5}} day(s)) has been APPROVED.
 */
async function sendLeaveApproved(
  phone,
  { firstName, leaveType, startDate, endDate, days },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyLeave", companyId);
    if (!s) return;
    const type = leaveType.charAt(0).toUpperCase() + leaveType.slice(1);
    const from = new Date(startDate).toLocaleDateString("en-IN");
    const to = new Date(endDate).toLocaleDateString("en-IN");
    await sendTemplate(
      phone,
      "neshr_leave_approved",
      [firstName, type, from, to, String(days)],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendLeaveApproved:", err.message);
  }
}

/**
 * Template: neshr_leave_rejected
 * Body:  Hi {{1}}, your {{2}} Leave request has been REJECTED. Reason: {{3}}.
 */
async function sendLeaveRejected(
  phone,
  { firstName, leaveType, reason },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyLeave", companyId);
    if (!s) return;
    const type = leaveType.charAt(0).toUpperCase() + leaveType.slice(1);
    await sendTemplate(
      phone,
      "neshr_leave_rejected",
      [firstName, type, reason || "Not specified"],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendLeaveRejected:", err.message);
  }
}

/**
 * Template: neshr_leave_request_hr
 * Body:  New Leave Request — Employee: {{1}} ({{2}}), Type: {{3}}, Dates: {{4}} to {{5}} ({{6}} day(s)), Reason: {{7}}.
 */
async function sendLeaveAppliedHR(
  phone,
  { empName, empId, leaveType, startDate, endDate, days, reason },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyLeave", companyId);
    if (!s) return;
    const type = leaveType.charAt(0).toUpperCase() + leaveType.slice(1);
    const from = new Date(startDate).toLocaleDateString("en-IN");
    const to = new Date(endDate).toLocaleDateString("en-IN");
    await sendTemplate(
      phone,
      "neshr_leave_request_hr",
      [empName, empId, type, from, to, String(days), reason || "-"],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendLeaveAppliedHR:", err.message);
  }
}

// ─── Attendance (HR copy) ─────────────────────────────────────────────────────

/**
 * Template: neshr_checkin_hr
 * Body:  Employee {{1}} (ID: {{2}}) checked in at {{3}} at {{4}}.
 */
async function sendCheckInHR(
  phone,
  { empName, empId, locationName, time },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyCheckIn", companyId);
    if (!s) return;
    const t = new Date(time).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
    await sendTemplate(
      phone,
      "neshr_checkin_hr",
      [empName, empId, locationName, t],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendCheckInHR:", err.message);
  }
}

/**
 * Template: neshr_checkout_hr
 * Body:  Employee {{1}} (ID: {{2}}) checked out at {{3}} at {{4}}. Total hours: {{5}}.
 */
async function sendCheckOutHR(
  phone,
  { empName, empId, locationName, time, workHours },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyCheckIn", companyId);
    if (!s) return;
    const t = new Date(time).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
    const hrs = workHours ? `${Number(workHours).toFixed(1)}h` : "-";
    await sendTemplate(
      phone,
      "neshr_checkout_hr",
      [empName, empId, locationName, t, hrs],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendCheckOutHR:", err.message);
  }
}

// ─── Payroll ──────────────────────────────────────────────────────────────────

/**
 * ════════════════════════════════════════════════════════════════
 *  META TEMPLATE — neshr_salary_paid
 *  Category : UTILITY   |  Language : English (en)
 * ════════════════════════════════════════════════════════════════
 *
 *  HEADER  → Type: DOCUMENT  (PDF payslip attached at send time)
 *
 *  BODY:
 *    Hi {{1}}, your salary for *{{2}}* has been credited! 🎉
 *
 *    💰 *Salary Breakdown*
 *    ━━━━━━━━━━━━━━━━━━━━━
 *    Basic Salary  : {{3}}
 *    Allowances    : {{4}}
 *    Overtime      : {{5}}
 *    Gross Salary  : {{6}}
 *    ━━━━━━━━━━━━━━━━━━━━━
 *    Deductions    : -{{7}}
 *    *Net Pay      : {{8}}*
 *    ━━━━━━━━━━━━━━━━━━━━━
 *    📅 Present : {{9}} / {{10}} days
 *    💳 Mode    : {{11}}
 *    🗓 Paid On : {{12}}
 *
 *  FOOTER:
 *    NestHR — Pixelate Nest
 *
 *  BUTTONS (2 Quick Reply):
 *    [0] Quick Reply → "✅ Received"
 *    [1] Quick Reply → "❌ Not Received"
 *
 * ════════════════════════════════════════════════════════════════
 *  VARIABLE MAP (12 body params)
 *    {{1}}  firstName        {{2}}  period
 *    {{3}}  basicSalary      {{4}}  allowances
 *    {{5}}  otPay            {{6}}  grossSalary
 *    {{7}}  totalDeductions  {{8}}  netSalary
 *    {{9}}  presentDays      {{10}} workingDays
 *    {{11}} paymentMode      {{12}} paidOn (DD/MM/YYYY)
 * ════════════════════════════════════════════════════════════════
 */
async function sendSalaryPaid(
  phone,
  {
    firstName,
    period,
    basicSalary,
    allowances,
    otPay,
    grossSalary,
    totalDeductions,
    netSalary,
    presentDays,
    workingDays,
    paymentMode,
    paidOn,
  },
  companyId,
  pdfBuffer = null,
) {
  const fmtINR = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n || 0);
  try {
    const s = await getCompanySetting("whatsappNotifyPayroll", companyId);
    if (!s) return;

    const extraComponents = [];

    if (pdfBuffer) {
      const mediaId = await uploadMediaToMeta(
        Buffer.from(pdfBuffer),
        `payslip_${period.replace(/\s/g, "_")}.pdf`,
      );
      if (mediaId) {
        extraComponents.push({
          type: "header",
          parameters: [
            {
              type: "document",
              document: {
                id: mediaId,
                filename: `Payslip_${period.replace(/\s/g, "_")}.pdf`,
              },
            },
          ],
        });
      }
    }

    extraComponents.push(
      {
        type: "button",
        sub_type: "quick_reply",
        index: "0",
        parameters: [{ type: "payload", payload: "PAYSLIP_RECEIVED" }],
      },
      {
        type: "button",
        sub_type: "quick_reply",
        index: "1",
        parameters: [{ type: "payload", payload: "PAYSLIP_NOT_RECEIVED" }],
      },
    );

    const MODE_LABELS = {
      bank_transfer: "Bank Transfer",
      cash: "Cash",
      upi: "UPI",
      cheque: "Cheque",
    };
    const modeLabel = MODE_LABELS[paymentMode] || "Bank Transfer";
    const toISTDateStr = (d) => {
      const ist = new Date(new Date(d).getTime() + 5.5 * 60 * 60 * 1000);
      return `${String(ist.getUTCDate()).padStart(2, "0")}/${String(ist.getUTCMonth() + 1).padStart(2, "0")}/${ist.getUTCFullYear()}`;
    };
    const paidOnStr = paidOn ? toISTDateStr(paidOn) : toISTDateStr(new Date());

    await sendTemplate(
      phone,
      "neshr_salary_paid",
      [
        firstName,
        period,
        fmtINR(basicSalary),
        fmtINR(allowances),
        fmtINR(otPay),
        fmtINR(grossSalary),
        fmtINR(totalDeductions),
        fmtINR(netSalary),
        String(presentDays || 0),
        String(workingDays || 0),
        modeLabel,
        paidOnStr,
      ],
      s.whatsappLang || "en",
      extraComponents,
    );
    console.log(`[WA-DEBUG] ✅ Salary paid notification sent to ${phone}`);
  } catch (err) {
    console.error("[WhatsApp] sendSalaryPaid:", err.message);
  }
}

// ─── Attendance Status Notification (single template for all statuses) ────────

const ATTENDANCE_STATUS_LABELS = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half Day",
};

/**
 * Template: neshr_attendance_status  (ONE template handles all 4 statuses)
 * Body:  Hi {{1}}, your attendance for {{2}} has been marked as *{{3}}*.
 *
 * Params: [firstName, date (DD/MM/YYYY), statusLabel]
 * statusLabel is one of: Present | Absent | Late | Half Day
 *
 * Triggered on: markAttendance and updateAttendance for statuses
 * present / late / absent / half_day.
 * Holiday, weekend, on_leave do NOT trigger this notification.
 */
async function sendAttendanceStatus(
  phone,
  { firstName, date, status },
  companyId,
) {
  const statusLabel = ATTENDANCE_STATUS_LABELS[status];
  if (!statusLabel) return; // skip holiday / weekend / on_leave
  try {
    const s = await getCompanySetting("whatsappNotifyCheckIn", companyId);
    if (!s) return;
    const d = new Date(date).toLocaleDateString("en-IN");
    await sendTemplate(
      phone,
      "neshr_attendance_status",
      [firstName, d, statusLabel],
      s.whatsappLang || "en",
    );
    console.log(
      `[WA-DEBUG] ✅ Attendance status (${statusLabel}) sent to ${phone}`,
    );
  } catch (err) {
    console.error("[WhatsApp] sendAttendanceStatus:", err.message);
  }
}

// ─── Loans / Advances ───────────────────────────────────────────────────────

/**
 * Template: neshr_loan_submitted
 * Body:  Hi {{1}}, your {{2}} request of ₹{{3}} ({{4}} month(s) tenure) has been submitted and is awaiting approval.
 */
async function sendLoanSubmitted(
  phone,
  { firstName, type, amount, tenureMonths },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyLeave", companyId);
    if (!s) return;
    const label = type === "advance" ? "Salary Advance" : "Loan";
    await sendTemplate(
      phone,
      "neshr_loan_submitted",
      [firstName, label, String(amount), String(tenureMonths || 0)],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendLoanSubmitted:", err.message);
  }
}

/**
 * Template: neshr_loan_approved
 * Body:  Hi {{1}}, your {{2}} request of ₹{{3}} has been APPROVED. Monthly EMI: ₹{{4}}.
 */
async function sendLoanApproved(
  phone,
  { firstName, type, amount, monthlyEmi },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyLeave", companyId);
    if (!s) return;
    const label = type === "advance" ? "Salary Advance" : "Loan";
    await sendTemplate(
      phone,
      "neshr_loan_approved",
      [firstName, label, String(amount), String(monthlyEmi || 0)],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendLoanApproved:", err.message);
  }
}

/**
 * Template: neshr_loan_rejected
 * Body:  Hi {{1}}, your {{2}} request of ₹{{3}} has been REJECTED. Reason: {{4}}.
 */
async function sendLoanRejected(
  phone,
  { firstName, type, amount, reason },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyLeave", companyId);
    if (!s) return;
    const label = type === "advance" ? "Salary Advance" : "Loan";
    await sendTemplate(
      phone,
      "neshr_loan_rejected",
      [firstName, label, String(amount), reason || "Not specified"],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendLoanRejected:", err.message);
  }
}

/**
 * Template: neshr_loan_request_hr
 * Body:  New {{1}} Request — Employee: {{2}} ({{3}}), Amount: ₹{{4}}, Tenure: {{5}} month(s), Reason: {{6}}.
 */
async function sendLoanAppliedHR(
  phone,
  { type, empName, empId, amount, tenureMonths, reason },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyLeave", companyId);
    if (!s) return;
    const label = type === "advance" ? "Salary Advance" : "Loan";
    await sendTemplate(
      phone,
      "neshr_loan_request_hr",
      [label, empName, empId, String(amount), String(tenureMonths || 0), reason || "-"],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendLoanAppliedHR:", err.message);
  }
}

// ─── Phone OTP Login (no per-company gate) ───────────────────────────────────

/**
 * Template: neshr_otp
 * Body:  {{1}} is your NestHR login OTP. It expires in 10 minutes. Do not share this code.
 */
async function sendPhoneOtp(phone, { otp }) {
  const accessToken = process.env.META_WA_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_ID;
  console.log(`[WA-OTP] token=${accessToken ? accessToken.slice(0,8)+'...' : 'MISSING'} phoneId=${phoneNumberId || 'MISSING'} to=${phone}`);
  if (!accessToken || !phoneNumberId) {
    console.warn("[WA-DEBUG] ABORT: META_WA_TOKEN or META_WA_PHONE_ID not set");
    return;
  }

  let toNumber = phone.replace(/^\+/, "").replace(/\s/g, "");
  if (/^[6-9]\d{9}$/.test(toNumber)) toNumber = "91" + toNumber;

  // Authentication templates require body + button components with the OTP
  const body = JSON.stringify({
    messaging_product: "whatsapp",
    to: toNumber,
    type: "template",
    template: {
      name: "neshr_otp",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: String(otp) }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: String(otp) }],
        },
      ],
    },
  });

  try {
    await new Promise((resolve, reject) => {
      const req = require("https").request(
        {
          hostname: "graph.facebook.com",
          path: `/v20.0/${phoneNumberId}/messages`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            Authorization: `Bearer ${accessToken}`,
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            console.log(`[WA-OTP] Meta API status=${res.statusCode} body=${data}`);
            if (res.statusCode >= 200 && res.statusCode < 300)
              resolve(JSON.parse(data));
            else reject(new Error(`Meta API ${res.statusCode}: ${data}`));
          });
        },
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
    console.log(`[WA-DEBUG] ✅ OTP sent to ${phone}`);
  } catch (err) {
    console.error(`[WA-DEBUG] ❌ OTP FAILED to ${phone}:`, err.message);
    throw err;
  }
}

// ─── NestHR Billing (no per-company gate) ────────────────────────────────────

/**
 * Template: neshr_subscription
 * Body:  Welcome {{1}}! Your {{2}} plan for {{3}} is active. Amount: {{4}}, Renewal: {{5}}. Login: {{6}}
 */
async function sendSubscriptionWA(
  phone,
  { toName, planName, companyName, amount, renewalDate, dashboardUrl },
) {
  try {
    const amt =
      typeof amount === "number"
        ? new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
          }).format(amount)
        : String(amount);
    const renewal = new Date(renewalDate).toLocaleDateString("en-IN");
    await sendTemplate(phone, "neshr_subscription", [
      toName,
      planName,
      companyName,
      amt,
      renewal,
      dashboardUrl,
    ]);
  } catch (err) {
    console.error("[WhatsApp] sendSubscriptionWA:", err.message);
  }
}

module.exports = {
  sendPhoneOtp,
  sendCheckIn,
  sendCheckOut,
  sendCheckInHR,
  sendCheckOutHR,
  sendLeaveSubmitted,
  sendLeaveApproved,
  sendLeaveRejected,
  sendLeaveAppliedHR,
  sendAttendanceStatus,
  sendSalaryPaid,
  sendSubscriptionWA,
  sendLoanSubmitted,
  sendLoanApproved,
  sendLoanRejected,
  sendLoanAppliedHR,
};
