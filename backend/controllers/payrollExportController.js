const asyncHandler = require("express-async-handler");
const Payroll = require("../models/Payroll");

const LEDGERS = {
  salaryExpense: "Salary Expense",
  pf: "PF Payable",
  esi: "ESI Payable",
  tds: "TDS Payable",
  loan: "Loan Recovery",
  otherDeductions: "Other Deductions",
  bank: "Salary Payable",
};

async function fetchPayrolls(req) {
  const { month, year } = req.query;
  const m = parseInt(month);
  const y = parseInt(year);
  if (!m || !y) return null;
  return Payroll.find({
    company: req.user.company,
    month: m,
    year: y,
    status: { $in: ["processed", "paid"] },
  }).populate("employee", "firstName lastName employeeId bankAccount accountHolderName ifscCode bankName");
}

function empName(p) {
  const e = p.employee;
  return e ? `${e.firstName} ${e.lastName} (${e.employeeId})` : "Unknown";
}

function xmlEscape(s) {
  return String(s).replace(
    /[<>&'"]/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[c],
  );
}

function tallyLedgerEntry(ledger, amount, isDebit) {
  return `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${xmlEscape(ledger)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${isDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
        <AMOUNT>${isDebit ? "-" : ""}${amount.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
}

function buildTallyVoucher(p, date) {
  const lines = [tallyLedgerEntry(LEDGERS.salaryExpense, p.grossSalary, true)];
  if (p.pf > 0) lines.push(tallyLedgerEntry(LEDGERS.pf, p.pf, false));
  if (p.esi > 0) lines.push(tallyLedgerEntry(LEDGERS.esi, p.esi, false));
  if (p.tds > 0) lines.push(tallyLedgerEntry(LEDGERS.tds, p.tds, false));
  if (p.loanDeduction > 0)
    lines.push(tallyLedgerEntry(LEDGERS.loan, p.loanDeduction, false));
  if (p.otherDeductions > 0)
    lines.push(
      tallyLedgerEntry(LEDGERS.otherDeductions, p.otherDeductions, false),
    );
  lines.push(tallyLedgerEntry(LEDGERS.bank, p.netSalary, false));

  return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER VCHTYPE="Journal" ACTION="Create">
        <DATE>${date}</DATE>
        <NARRATION>Salary for ${xmlEscape(empName(p))} - ${p.month}/${p.year}</NARRATION>
        <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>${lines.join("")}
      </VOUCHER>
    </TALLYMESSAGE>`;
}

const exportTally = asyncHandler(async (req, res) => {
  const payrolls = await fetchPayrolls(req);
  if (payrolls === null) {
    res.status(400);
    throw new Error("month and year are required");
  }
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const xml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>${payrolls.map((p) => buildTallyVoucher(p, date)).join("")}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  res.setHeader("Content-Type", "application/xml");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Tally_Salary_${req.query.month}_${req.query.year}.xml"`,
  );
  res.send(xml);
});

function csvEscape(s) {
  const v = String(s ?? "");
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function csvRow(fields) {
  return fields.map(csvEscape).join(",") + "\r\n";
}

const exportZoho = asyncHandler(async (req, res) => {
  const payrolls = await fetchPayrolls(req);
  if (payrolls === null) {
    res.status(400);
    throw new Error("month and year are required");
  }
  const now = now_str();
  const header = [
    "Journal Date",
    "Journal Number",
    "Reference Number",
    "Notes",
    "Account",
    "Contact Name",
    "Debit",
    "Credit",
  ];
  let csv = csvRow(header);

  payrolls.forEach((p, i) => {
    const journalNo = `SAL-${p.year}${String(p.month).padStart(2, "0")}-${i + 1}`;
    const notes = `Salary for ${empName(p)} - ${p.month}/${p.year}`;
    const contact = empName(p);
    const rows = [[LEDGERS.salaryExpense, p.grossSalary, 0]];
    if (p.pf > 0) rows.push([LEDGERS.pf, 0, p.pf]);
    if (p.esi > 0) rows.push([LEDGERS.esi, 0, p.esi]);
    if (p.tds > 0) rows.push([LEDGERS.tds, 0, p.tds]);
    if (p.loanDeduction > 0) rows.push([LEDGERS.loan, 0, p.loanDeduction]);
    if (p.otherDeductions > 0)
      rows.push([LEDGERS.otherDeductions, 0, p.otherDeductions]);
    rows.push([LEDGERS.bank, 0, p.netSalary]);

    rows.forEach(([account, debit, credit]) => {
      csv += csvRow([
        now,
        journalNo,
        journalNo,
        notes,
        account,
        contact,
        debit ? debit.toFixed(2) : "",
        credit ? credit.toFixed(2) : "",
      ]);
    });
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Zoho_Salary_${req.query.month}_${req.query.year}.csv"`,
  );
  res.send(csv);
});

// Generic bulk-transfer CSV (most corporate banking portals accept this layout after minor column mapping).
// Text fields are guarded against spreadsheet formula injection; rows lacking bank details are flagged, not dropped.
const guard = (v) => (/^[=+\-@\t\r]/.test(String(v ?? "")) ? `\'${v}` : v);

const exportBank = asyncHandler(async (req, res) => {
  const payrolls = await fetchPayrolls(req);
  if (payrolls === null) {
    res.status(400);
    throw new Error("month and year are required");
  }
  const narration = `Salary ${String(req.query.month).padStart(2, "0")}-${req.query.year}`;
  let csv = csvRow([
    "Sr No",
    "Beneficiary Name",
    "Account Number",
    "IFSC",
    "Bank Name",
    "Amount",
    "Narration",
    "Employee ID",
    "Remarks",
  ]);
  payrolls
    .filter((p) => p.netSalary > 0)
    .forEach((p, i) => {
      const e = p.employee || {};
      const missing = !e.bankAccount || !e.ifscCode;
      csv += csvRow([
        i + 1,
        guard(e.accountHolderName || `${e.firstName || ""} ${e.lastName || ""}`.trim()),
        guard(e.bankAccount || ""),
        guard((e.ifscCode || "").toUpperCase()),
        guard(e.bankName || ""),
        p.netSalary.toFixed(2),
        narration,
        guard(e.employeeId || ""),
        missing ? "BANK DETAILS MISSING" : "",
      ]);
    });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Bank_Salary_${req.query.month}_${req.query.year}.csv"`,
  );
  res.send(csv);
});

function now_str() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

module.exports = { exportTally, exportZoho, exportBank };
