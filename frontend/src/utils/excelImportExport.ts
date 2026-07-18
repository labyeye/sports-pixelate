import * as XLSX from "xlsx";

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
  const headerRow = headers.map((h) => h.label);
  const exampleRow = headers.map((h) => h.example);
  const ws = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
  ws["!cols"] = headers.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// Parses an uploaded .xlsx/.xls file into an array of { [headerKey]: value }
// objects, matching column labels (case-insensitive) back to header keys.
export function parseImportFile(
  file: File,
  headers: ImportHeader[],
): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, {
          type: "array",
          cellDates: true,
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
        });
        if (raw.length < 2) {
          resolve([]);
          return;
        }

        const headerRow = (raw[0] as string[]).map((h) => String(h).trim());
        const labelToKey: Record<string, string> = {};
        headers.forEach((h) => {
          labelToKey[h.label.toLowerCase()] = h.key;
        });

        const parsed = raw
          .slice(1)
          .filter((r) => r.some((c) => c !== ""))
          .map((row) => {
            const obj: Record<string, string> = {};
            headerRow.forEach((hdr, i) => {
              const key = labelToKey[hdr.toLowerCase()];
              if (key) {
                const val = row[i];
                if (val instanceof Date) {
                  obj[key] = val.toISOString().split("T")[0];
                } else {
                  obj[key] = String(val ?? "").trim();
                }
              }
            });
            return obj;
          });

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// Exports rows of data to an .xlsx file, one column per header.
export function exportRowsToExcel(
  headers: { key: string; label: string }[],
  rows: any[],
  filename: string,
  sheetName = "Sheet1",
) {
  const headerRow = headers.map((h) => h.label);
  const dataRows = rows.map((row) =>
    headers.map((h) => {
      const val = row[h.key];
      return val === undefined || val === null ? "" : val;
    }),
  );
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  ws["!cols"] = headers.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
