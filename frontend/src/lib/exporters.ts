import { writeSheet, readObjects } from "./sheets";
import jsPDF from "jspdf";

export interface ExportCol<T = any> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

const cell = (v: unknown) => (v === null || v === undefined ? "" : v);
const stamp = () => new Date().toISOString().slice(0, 10);

export function exportExcel<T>(name: string, cols: ExportCol<T>[], rows: T[]) {
  const aoa = [
    cols.map((c) => c.header),
    ...rows.map((r) => cols.map((c) => cell(c.value(r)))),
  ];
  void writeSheet(`${name}_${stamp()}.xlsx`, name, aoa);
}

// ponytail: plain-text table, long cells are clipped; swap in jspdf-autotable if wrapping is needed.
export function exportPdf<T>(name: string, cols: ExportCol<T>[], rows: T[]) {
  const pdf = new jsPDF({
    orientation: cols.length > 6 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const m = 30;
  const cw = (W - m * 2) / cols.length;
  const fit = (s: string, size: number) => {
    const max = Math.floor(cw / (size * 0.52));
    return s.length > max ? s.slice(0, Math.max(1, max - 1)) + "..." : s;
  };
  let y = m;
  const header = () => {
    pdf.setFont("helvetica", "bold").setFontSize(14).text(name, m, y);
    y += 20;
    pdf.setFillColor(2, 75, 171).rect(m, y - 10, W - m * 2, 16, "F");
    pdf.setFontSize(8).setTextColor(255);
    cols.forEach((c, i) => pdf.text(fit(c.header, 8), m + i * cw + 3, y + 1));
    pdf.setTextColor(0).setFont("helvetica", "normal");
    y += 16;
  };
  header();
  rows.forEach((r, n) => {
    if (y > H - m) {
      pdf.addPage();
      y = m;
      header();
    }
    if (n % 2)
      pdf.setFillColor(243, 246, 252).rect(m, y - 9, W - m * 2, 14, "F");
    cols.forEach((c, i) =>
      pdf.text(fit(String(cell(c.value(r))), 8), m + i * cw + 3, y),
    );
    y += 14;
  });
  pdf.save(`${name}_${stamp()}.pdf`);
}

/** Reads the first sheet of an .xlsx/.xls/.csv file into header-keyed objects. */
export async function readSheet(file: File): Promise<Record<string, any>[]> {
  return readObjects(file);
}

export function downloadTemplate(
  name: string,
  headers: string[],
  example: (string | number)[],
) {
  void writeSheet(`${name}_template.xlsx`, "Template", [headers, example]);
}
