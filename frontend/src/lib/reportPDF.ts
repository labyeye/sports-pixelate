// Generic "table → PDF" download used by every report. Takes the same
// `[headers, ...rows]` array the CSV export uses, so each report gets a PDF
// button without needing its own layout code.
let companyName = "NestPlay";
export function setReportCompanyName(name?: string) {
  if (name) companyName = name;
}

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export async function exportPDF(rows: string[][], filename: string) {
  if (!rows || rows.length === 0) return;
  const { jsPDF } = await import("jspdf");

  const headers = rows[0].map((h) => String(h ?? ""));
  const body = rows.slice(1).map((r) => r.map((c) => String(c ?? "")));
  const cols = headers.length;

  const doc = new jsPDF({
    orientation: cols > 5 ? "landscape" : "portrait",
    unit: "pt",
    format: cols > 11 ? "a3" : "a4",
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 28;
  const usable = pageW - margin * 2;

  // Shrink the font as columns grow so wide reports still fit on the page.
  const fontSize = cols <= 6 ? 9 : cols <= 9 ? 8 : cols <= 13 ? 7 : 6;
  const lineH = fontSize * 1.35;
  const padX = 4;
  const padY = 3.5;

  // Column widths: proportional to the widest content (header or cell, capped).
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  const want = headers.map((h, i) => {
    let w = doc.getTextWidth(h);
    doc.setFont("helvetica", "normal");
    for (const r of body)
      w = Math.max(w, Math.min(doc.getTextWidth(r[i] ?? ""), 180));
    doc.setFont("helvetica", "bold");
    return w + padX * 2 + 2;
  });
  const total = want.reduce((a, b) => a + b, 0);
  const widths = want.map((w) => (w / total) * usable);

  const title = titleFromFilename(filename);
  const generated = new Date().toLocaleString("en-IN");

  let y = margin;
  const drawHeaderBlock = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(2, 75, 171);
    doc.text(companyName, margin, y + 6);
    doc.setFontSize(12);
    doc.setTextColor(10, 10, 10);
    doc.text(title, margin, y + 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(
      `Generated ${generated}  ·  ${body.length} record${body.length === 1 ? "" : "s"}`,
      pageW - margin,
      y + 24,
      { align: "right" },
    );
    y += 38;
  };

  const drawTableHeader = () => {
    const h = lineH + padY * 2;
    doc.setFillColor(2, 75, 171);
    doc.rect(margin, y, usable, h, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor(255, 255, 255);
    let x = margin;
    headers.forEach((t, i) => {
      doc.text(
        doc.splitTextToSize(t, widths[i] - padX * 2)[0] ?? "",
        x + padX,
        y + padY + fontSize,
      );
      x += widths[i];
    });
    y += h;
  };

  drawHeaderBlock();
  drawTableHeader();

  doc.setFont("helvetica", "normal");
  body.forEach((row, idx) => {
    const cells = row.map(
      (c, i) => doc.splitTextToSize(c, widths[i] - padX * 2) as string[],
    );
    const rowH = Math.max(...cells.map((c) => c.length), 1) * lineH + padY * 2;
    if (y + rowH > pageH - margin - 14) {
      doc.addPage();
      y = margin;
      drawTableHeader();
      doc.setFont("helvetica", "normal");
    }
    if (idx % 2 === 1) {
      doc.setFillColor(240, 246, 255);
      doc.rect(margin, y, usable, rowH, "F");
    }
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);
    let x = margin;
    cells.forEach((lines, i) => {
      lines.forEach((ln, li) =>
        doc.text(ln, x + padX, y + padY + fontSize + li * lineH),
      );
      x += widths[i];
    });
    doc.setDrawColor(210, 214, 222);
    doc.setLineWidth(0.4);
    doc.line(margin, y + rowH, margin + usable, y + rowH);
    y += rowH;
  });

  // Page numbers.
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${p} of ${n}`, pageW - margin, pageH - 14, {
      align: "right",
    });
    doc.text(companyName, margin, pageH - 14);
  }

  doc.save(filename.replace(/\.[^.]+$/, "") + ".pdf");
}
