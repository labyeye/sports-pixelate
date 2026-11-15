// Spreadsheet read/write on exceljs (replaces the unpatched "xlsx" package). Loaded on demand so it stays out of the main bundle.
// Reads .xlsx and .csv; legacy binary .xls is not supported.

export type Aoa = unknown[][];

const load = async () => (await import("exceljs")).default;

function download(buf: BlobPart, filename: string, type: string) {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([buf], { type })),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function writeSheet(
  filename: string,
  sheetName: string,
  aoa: Aoa,
  colWidth = 0,
) {
  const ExcelJS = await load();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  aoa.forEach((r) => ws.addRow(r.map((c) => c ?? null) as any[]));
  if (colWidth) ws.columns.forEach((c) => (c.width = colWidth));
  download(
    await wb.xlsx.writeBuffer(),
    filename,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') ((cur += '"'), i++);
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") (row.push(cur), (cur = ""));
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur !== "" || row.length) (row.push(cur), rows.push(row));
  return rows;
}

/** First sheet of an .xlsx/.csv file as rows; empty cells are "", dates stay Date. */
export async function readRows(file: File): Promise<any[][]> {
  if (/\.xls$/i.test(file.name))
    throw new Error(
      "Old .xls files are not supported. Save it as .xlsx or .csv.",
    );
  if (/\.csv$/i.test(file.name))
    return parseCsv((await file.text()).replace(/^﻿/, ""));
  const ExcelJS = await load();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  const out: any[][] = [];
  ws?.eachRow({ includeEmpty: true }, (row) => {
    const vals: any[] = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      let v: any = row.getCell(c).value;
      if (v && typeof v === "object" && !(v instanceof Date)) {
        if ("result" in v) v = (v as any).result;
        else if ("text" in v) v = (v as any).text;
        else if ("richText" in v)
          v = (v as any).richText.map((t: any) => t.text).join("");
      }
      vals.push(v ?? "");
    }
    out.push(vals);
  });
  return out;
}

const str = (v: any) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").trim();

/** Header-keyed objects with every value as a trimmed string. */
export async function readObjects(
  file: File,
): Promise<Record<string, string>[]> {
  const rows = await readRows(file);
  const head = (rows[0] || []).map(str);
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c !== "" && c != null))
    .map((r) => {
      const o: Record<string, string> = {};
      head.forEach((h, i) => {
        if (h) o[h] = str(r[i]);
      });
      return o;
    });
}
