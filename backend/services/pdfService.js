const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const CHEQUE_PATH = path.join(
  __dirname,
  "../../frontend/assets/payrollcheque.pdf",
);

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function fmt(n) {
  return (
    "Rs. " +
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0)
  );
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

function toIndianWords(n) {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  if (!n || n === 0) return "Zero";
  const two = (x) =>
    x < 20
      ? ones[x]
      : tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "");
  let r = "",
    x = Math.round(n);
  const cr = Math.floor(x / 10000000);
  x %= 10000000;
  const lk = Math.floor(x / 100000);
  x %= 100000;
  const th = Math.floor(x / 1000);
  x %= 1000;
  const hu = Math.floor(x / 100);
  x %= 100;
  if (cr) r += two(cr) + " Crore ";
  if (lk) r += two(lk) + " Lakh ";
  if (th) r += two(th) + " Thousand ";
  if (hu) r += ones[hu] + " Hundred ";
  if (x) r += two(x);
  return "Rupees " + r.trim() + " Only";
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

async function generatePayslipPdf(payroll, employee, company) {
  const net = Math.round(payroll.netSalary || 0);
  // Use IST (UTC+5:30) to avoid UTC date being one day behind for India
  const nowIST = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
  const dd = String(nowIST.getUTCDate()).padStart(2, "0");
  const mm = String(nowIST.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(nowIST.getUTCFullYear()); // 4-digit year, matching frontend
  const lastDay = new Date(payroll.year, payroll.month, 0).getDate();
  const fromDate = `01/${String(payroll.month).padStart(2, "0")}/${payroll.year}`;
  const toDate = `${lastDay}/${String(payroll.month).padStart(2, "0")}/${payroll.year}`;
  const empName =
    `${employee.firstName || ""} ${employee.lastName || ""}`.trim();

  let pdfDoc;
  if (fs.existsSync(CHEQUE_PATH)) {
    const templateBytes = fs.readFileSync(CHEQUE_PATH);
    pdfDoc = await PDFDocument.load(templateBytes);
  } else {
    pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([576, 263.25]);
  }

  const [chequePage] = pdfDoc.getPages();
  const { height: ph } = chequePage.getSize();
  // MediaBox may have a non-zero y origin (this template has y≈7.71).
  // pdfjs accounts for this when rendering on canvas; pdf-lib getSize() does not.
  // Top of visible page in PDF coords = mediaBox.y + mediaBox.height.
  const mediaBox = chequePage.getMediaBox();
  const pageTop = mediaBox.y + mediaBox.height; // ≈ 270.96 for this template

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // POS coordinates are CSS px from the frontend (1:1 with PDF pts for this template).
  // Canvas origin is top-left; pdf-lib origin is bottom-left.
  // Must use pageTop (mediaBox.y + height) not just height, because this template's
  // MediaBox has a non-zero y origin (~7.71 pts) that pdfjs accounts for automatically.
  const dt = (text, x, cssY, size = 11, bold = false) => {
    chequePage.drawText(String(text).replace(/[\r\n]+/g, " "), {
      x,
      y: pageTop - cssY,
      size,
      font: bold ? boldFont : font,
      color: rgb(0, 0, 0),
    });
  };

  // Word-wrap matching frontend wrapText(pos, value, maxWidth=300, lineHeight=14)
  const dtWrap = (text, x, cssY, size, maxWidth, lineHeight) => {
    const words = String(text)
      .replace(/[\r\n]+/g, " ")
      .split(" ");
    let line = "";
    let y = cssY;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        dt(line, x, y, size, false);
        line = word;
        y += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) dt(line, x, y, size, false);
  };

  // Mirror of PayrollPage.tsx POS map exactly
  dt(company.name || "", 75, 30, 13, true);
  dtWrap(company.address || "", 75, 48, 11, 300, 14);

  // Date: DDMMYYYY — one character per box (same as frontend dateChars)
  const dateStr = dd + mm + yyyy;
  const dateCharX = [430, 445, 460, 475, 491, 507, 523, 538];
  dateCharX.forEach((x, i) => dt(dateStr[i] ?? "", x, 36, 11, false));

  dt(empName, 100, 120, 11, false);
  dt(employee.employeeId || "—", 320, 120, 11, false);
  dt(employee.designation || "—", 435, 120, 11, false);
  dt(toIndianWords(net), 115, 145, 11, false);
  dt(net.toLocaleString("en-IN"), 440, 150, 13, true);
  dt(fromDate, 250, 174, 11, false);
  dt(toDate, 340, 174, 11, false);

  // Embed company logo if provided (matches frontend canvas logo drawing)
  if (company.logo) {
    try {
      let logoBytes;
      if (
        company.logo.startsWith("http://") ||
        company.logo.startsWith("https://")
      ) {
        logoBytes = await fetchBuffer(company.logo);
      } else if (company.logo.startsWith("/uploads/")) {
        // Logo stored as /uploads/... → served from backend/uploads/
        const absPath = path.join(__dirname, "..", company.logo);
        if (fs.existsSync(absPath)) {
          logoBytes = fs.readFileSync(absPath);
        } else {
          console.warn("[pdfService] Logo file not found at:", absPath);
        }
      } else if (company.logo.startsWith("data:")) {
        const base64 = company.logo.split(",")[1];
        logoBytes = Buffer.from(base64, "base64");
      }
      if (logoBytes) {
        const logoX = company.chequeLogoX ?? 10;
        const logoY = company.chequeLogoY ?? 20;
        const logoW = company.chequeLogoW ?? 60;
        let embeddedLogo;
        const sig = logoBytes.slice(0, 4);
        if (sig[0] === 0x89 && sig[1] === 0x50) {
          embeddedLogo = await pdfDoc.embedPng(logoBytes);
        } else {
          embeddedLogo = await pdfDoc.embedJpg(logoBytes);
        }
        const { width: iw, height: ih } = embeddedLogo.scale(1);
        const drawW = logoW;
        const drawH = iw > 0 ? (ih / iw) * drawW : drawW;
        chequePage.drawImage(embeddedLogo, {
          x: logoX,
          y: pageTop - logoY - drawH,
          width: drawW,
          height: drawH,
        });
      }
    } catch (logoErr) {
      console.warn("[pdfService] Logo embed failed:", logoErr.message);
    }
  }

  return await pdfDoc.save();
}

// Renders a verified subscription payment as the same cheque template used
// for payroll payslips, so parents get a visually consistent "cheque" receipt
// on both mobile and web instead of the old plain document-style receipt.
async function generatePaymentReceiptPdf({ subscription, payment, company }) {
  const amount = Math.round(payment.amount || 0);
  const verifiedOn = payment.verifiedAt ? new Date(payment.verifiedAt) : new Date();
  const dd = String(verifiedOn.getDate()).padStart(2, "0");
  const mm = String(verifiedOn.getMonth() + 1).padStart(2, "0");
  const yyyy = String(verifiedOn.getFullYear());
  const fromDate = subscription.startDate
    ? new Date(subscription.startDate).toLocaleDateString("en-GB")
    : "—";
  const toDate = subscription.renewalDate
    ? new Date(subscription.renewalDate).toLocaleDateString("en-GB")
    : "—";
  const studentName = `${subscription.student?.firstName || ""} ${
    subscription.student?.lastName || ""
  }`.trim();

  let pdfDoc;
  if (fs.existsSync(CHEQUE_PATH)) {
    const templateBytes = fs.readFileSync(CHEQUE_PATH);
    pdfDoc = await PDFDocument.load(templateBytes);
  } else {
    pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([576, 263.25]);
  }

  const [chequePage] = pdfDoc.getPages();
  const mediaBox = chequePage.getMediaBox();
  const pageTop = mediaBox.y + mediaBox.height;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const dt = (text, x, cssY, size = 11, bold = false) => {
    chequePage.drawText(String(text).replace(/[\r\n]+/g, " "), {
      x,
      y: pageTop - cssY,
      size,
      font: bold ? boldFont : font,
      color: rgb(0, 0, 0),
    });
  };

  const dtWrap = (text, x, cssY, size, maxWidth, lineHeight) => {
    const words = String(text)
      .replace(/[\r\n]+/g, " ")
      .split(" ");
    let line = "";
    let y = cssY;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        dt(line, x, y, size, false);
        line = word;
        y += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) dt(line, x, y, size, false);
  };

  dt(company.name || "", 75, 30, 13, true);
  dtWrap(company.address || "", 75, 48, 11, 300, 14);

  const dateStr = dd + mm + yyyy;
  const dateCharX = [430, 445, 460, 475, 491, 507, 523, 538];
  dateCharX.forEach((x, i) => dt(dateStr[i] ?? "", x, 36, 11, false));

  dt(studentName || "—", 100, 120, 11, false);
  dt(subscription.student?.studentId || "—", 320, 120, 11, false);
  dt(subscription.planName || "—", 435, 120, 11, false);
  dt(toIndianWords(amount), 115, 145, 11, false);
  dt(amount.toLocaleString("en-IN"), 440, 150, 13, true);
  dt(fromDate, 250, 174, 11, false);
  dt(toDate, 340, 174, 11, false);

  if (company.logo) {
    try {
      let logoBytes;
      if (
        company.logo.startsWith("http://") ||
        company.logo.startsWith("https://")
      ) {
        logoBytes = await fetchBuffer(company.logo);
      } else if (company.logo.startsWith("/uploads/")) {
        const absPath = path.join(__dirname, "..", company.logo);
        if (fs.existsSync(absPath)) {
          logoBytes = fs.readFileSync(absPath);
        }
      } else if (company.logo.startsWith("data:")) {
        const base64 = company.logo.split(",")[1];
        logoBytes = Buffer.from(base64, "base64");
      }
      if (logoBytes) {
        const logoX = company.chequeLogoX ?? 10;
        const logoY = company.chequeLogoY ?? 20;
        const logoW = company.chequeLogoW ?? 60;
        let embeddedLogo;
        const sig = logoBytes.slice(0, 4);
        if (sig[0] === 0x89 && sig[1] === 0x50) {
          embeddedLogo = await pdfDoc.embedPng(logoBytes);
        } else {
          embeddedLogo = await pdfDoc.embedJpg(logoBytes);
        }
        const { width: iw, height: ih } = embeddedLogo.scale(1);
        const drawW = logoW;
        const drawH = iw > 0 ? (ih / iw) * drawW : drawW;
        chequePage.drawImage(embeddedLogo, {
          x: logoX,
          y: pageTop - logoY - drawH,
          width: drawW,
          height: drawH,
        });
      }
    } catch (logoErr) {
      console.warn("[pdfService] Logo embed failed:", logoErr.message);
    }
  }

  return await pdfDoc.save();
}

module.exports = { generatePayslipPdf, generatePaymentReceiptPdf };
