const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

function formatCurrency(amount) {
  return `Rs. ${Math.round(amount || 0).toLocaleString("en-IN")}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Renders a single-page payment receipt for one verified payment entry.
async function generateReceiptPdf({ subscription, payment }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 560]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const blue = rgb(0.01, 0.29, 0.67);

  let y = 510;
  const left = 32;

  page.drawText("Payment Receipt", {
    x: left,
    y,
    size: 20,
    font: bold,
    color: black,
  });
  y -= 20;
  page.drawText("NestSports", { x: left, y, size: 11, font, color: gray });
  y -= 30;

  const row = (label, value) => {
    page.drawText(label, { x: left, y, size: 10, font, color: gray });
    page.drawText(String(value ?? "-"), {
      x: left + 160,
      y,
      size: 10,
      font: bold,
      color: black,
    });
    y -= 22;
  };

  row(
    "Receipt No.",
    `${subscription._id}-${payment._id}`.slice(-18).toUpperCase(),
  );
  row(
    "Student",
    `${subscription.student?.firstName || ""} ${subscription.student?.lastName || ""}`.trim(),
  );
  row("Plan", subscription.planName);
  row("Billing Cycle", subscription.billingCycle);
  row(
    "Payment Method",
    payment.method === "razorpay" ? "Online (Razorpay)" : "UPI / QR",
  );
  if (payment.utrNumber) row("UTR Number", payment.utrNumber);
  if (payment.transactionNumber)
    row("Transaction No.", payment.transactionNumber);
  row("Submitted On", formatDate(payment.submittedAt));
  row("Verified On", formatDate(payment.verifiedAt));

  y -= 10;
  page.drawLine({
    start: { x: left, y },
    end: { x: 420 - left, y },
    thickness: 1,
    color: gray,
  });
  y -= 30;

  page.drawText("Amount Paid", {
    x: left,
    y,
    size: 12,
    font: bold,
    color: black,
  });
  page.drawText(formatCurrency(payment.amount), {
    x: left + 160,
    y,
    size: 14,
    font: bold,
    color: blue,
  });
  y -= 40;

  page.drawText("This receipt confirms a verified payment toward the", {
    x: left,
    y,
    size: 8,
    font,
    color: gray,
  });
  y -= 12;
  page.drawText("subscription's total due amount. It is not a tax invoice.", {
    x: left,
    y,
    size: 8,
    font,
    color: gray,
  });

  return doc.save();
}

module.exports = { generateReceiptPdf };
