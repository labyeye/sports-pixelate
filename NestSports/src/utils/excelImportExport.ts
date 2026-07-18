import * as XLSX from 'xlsx';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { pick, types } from '@react-native-documents/picker';

export interface ImportHeader {
  key: string;
  label: string;
  required: boolean;
  example: string;
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Opens the native document picker restricted to Excel/CSV files, reads the
// picked file as base64 via react-native-fs, and parses it with SheetJS —
// the RN equivalent of the web app's <input type="file"> + FileReader flow.
export async function pickAndParseExcelFile(
  headers: ImportHeader[],
): Promise<Record<string, string>[] | null> {
  const [file] = await pick({
    type: [types.xlsx, types.xls, types.csv],
  });
  if (!file) return null;

  const base64 = await RNFS.readFile(file.uri, 'base64');
  const wb = XLSX.read(base64, { type: 'base64', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
  });
  if (raw.length < 2) return [];

  const headerRow = (raw[0] as string[]).map(h => String(h).trim());
  const labelToKey: Record<string, string> = {};
  headers.forEach(h => {
    labelToKey[h.label.toLowerCase()] = h.key;
  });

  return raw
    .slice(1)
    .filter(r => r.some(c => c !== ''))
    .map(row => {
      const obj: Record<string, string> = {};
      headerRow.forEach((hdr, i) => {
        const key = labelToKey[hdr.toLowerCase()];
        if (key) {
          const val = row[i];
          if (val instanceof Date) {
            obj[key] = val.toISOString().split('T')[0];
          } else {
            obj[key] = String(val ?? '').trim();
          }
        }
      });
      return obj;
    });
}

// Builds a blank template workbook (header row + one example row) and opens
// the native share sheet so the user can save/send it.
export async function shareImportTemplate(
  headers: ImportHeader[],
  filename: string,
  sheetName = 'Sheet1',
) {
  const headerRow = headers.map(h => h.label);
  const exampleRow = headers.map(h => h.example);
  const ws = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  await writeAndShareWorkbook(ws, filename, sheetName);
}

// Exports rows of data to an .xlsx file and opens the native share sheet.
export async function exportRowsToExcel(
  headers: { key: string; label: string }[],
  rows: any[],
  filename: string,
  sheetName = 'Sheet1',
) {
  const headerRow = headers.map(h => h.label);
  const dataRows = rows.map(row =>
    headers.map(h => {
      const val = row[h.key];
      return val === undefined || val === null ? '' : val;
    }),
  );
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  await writeAndShareWorkbook(ws, filename, sheetName);
}

async function writeAndShareWorkbook(
  ws: XLSX.WorkSheet,
  filename: string,
  sheetName: string,
) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const path = `${RNFS.CachesDirectoryPath}/${filename}`;
  await RNFS.writeFile(path, base64, 'base64');
  await Share.open({
    url: `file://${path}`,
    type: XLSX_MIME,
    filename,
    failOnCancel: false,
  });
}
