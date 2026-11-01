// exceljs is loaded on demand: it is large and only needed on import/export.
const loadExcel = () => import("exceljs");

async function saveWorkbook(wb: any, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function writeSheet(
  rows: unknown[][],
  filename: string,
  sheetName = "Sheet1",
  colWidth = 22,
) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  rows.forEach((r) => ws.addRow(r));
  ws.columns.forEach((c) => (c.width = colWidth));
  await saveWorkbook(wb, filename);
}

export interface ImportHeader {
  key: string;
  label: string;
  required: boolean;
  example: string;
}

// Downloads a blank template workbook with the header row + one example row,
// so users can fill it in and re-upload via parseImportFile.
export function downloadImportTemplate(
  headers: ImportHeader[],
  filename: string,
  sheetName = "Sheet1",
) {
  return writeSheet(
    [headers.map((h) => h.label), headers.map((h) => h.example)],
    filename,
    sheetName,
  );
}

// Parses an uploaded .xlsx/.xls file into an array of { [headerKey]: value }
// objects, matching column labels (case-insensitive) back to header keys.
export async function parseImportFile(
  file: File,
  headers: ImportHeader[],
): Promise<Record<string, string>[]> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const cell = (v: any): any => {
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("result" in v) return v.result;
      if ("text" in v) return v.text;
      if ("richText" in v) return v.richText.map((t: any) => t.text).join("");
    }
    return v;
  };
  const raw: any[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = (row.values as any[]).slice(1).map(cell);
    raw.push(vals.map((v) => v ?? ""));
  });
  if (raw.length < 2) return [];

  const headerRow = raw[0].map((h) => String(h).trim());
  const labelToKey: Record<string, string> = {};
  headers.forEach((h) => {
    labelToKey[h.label.toLowerCase()] = h.key;
  });

  return raw
    .slice(1)
    .filter((r) => r.some((c) => c !== ""))
    .map((row) => {
      const obj: Record<string, string> = {};
      headerRow.forEach((hdr, i) => {
        const key = labelToKey[hdr.toLowerCase()];
        if (key) {
          const val = row[i];
          obj[key] =
            val instanceof Date
              ? val.toISOString().split("T")[0]
              : String(val ?? "").trim();
        }
      });
      return obj;
    });
}

// Exports rows of data to an .xlsx file, one column per header.
export function exportRowsToExcel(
  headers: { key: string; label: string }[],
  rows: any[],
  filename: string,
  sheetName = "Sheet1",
) {
  return writeSheet(
    [
      headers.map((h) => h.label),
      ...rows.map((row) =>
        headers.map((h) => {
          const val = row[h.key];
          return val === undefined || val === null ? "" : val;
        }),
      ),
    ],
    filename,
    sheetName,
  );
}
