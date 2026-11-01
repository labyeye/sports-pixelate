import { Alert } from 'react-native';
import { buildXlsxBase64, readXlsxBase64, parseCsv } from './xlsxLite';
import RNPrint from 'react-native-print';
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
// picked file as base64 via react-native-fs, and parses it (xlsxLite) —
// the RN equivalent of the web app's <input type="file"> + FileReader flow.
export async function pickAndParseExcelFile(
  headers: ImportHeader[],
): Promise<Record<string, string>[] | null> {
  const [file] = await pick({
    type: [types.xlsx, types.csv],
  });
  if (!file) return null;

  const isCsv = /\.csv$/i.test(file.name || '') || file.type === 'text/csv';
  const raw: any[][] = isCsv
    ? parseCsv(await RNFS.readFile(file.uri, 'utf8'))
    : readXlsxBase64(await RNFS.readFile(file.uri, 'base64'));
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
  await writeAndShareWorkbook([headerRow, exampleRow], filename, sheetName);
}

// Exports rows of data to an .xlsx file and opens the native share sheet.
const escapeHtml = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Opens the native print/preview sheet with every row in a table — from there
// the user can "Save as PDF" / share (iOS share sheet, Android print dialog).
async function printRowsAsPDF(
  headers: { key: string; label: string }[],
  rows: any[],
  filename: string,
) {
  const title = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  const head = headers.map(h => `<th>${escapeHtml(h.label)}</th>`).join('');
  const body = rows
    .map(
      r =>
        `<tr>${headers.map(h => `<td>${escapeHtml(r[h.key])}</td>`).join('')}</tr>`,
    )
    .join('');
  const html = `<html><head><meta name="viewport" content="width=device-width"/><style>
    body{font-family:Helvetica,Arial,sans-serif;font-size:${headers.length > 8 ? 8 : 10}px;color:#0a0a0a;margin:16px}
    h1{font-size:16px;margin:0 0 2px;color:#024BAB} .meta{color:#666;font-size:9px;margin-bottom:10px}
    table{border-collapse:collapse;width:100%} th{background:#024BAB;color:#fff;text-align:left}
    th,td{padding:4px 6px;border-bottom:1px solid #d7dbe3;vertical-align:top;word-break:break-word}
    tr:nth-child(even) td{background:#f0f6ff} thead{display:table-header-group} tr{page-break-inside:avoid}
  </style></head><body><h1>${escapeHtml(title)}</h1>
  <div class="meta">Generated ${escapeHtml(new Date().toLocaleString('en-IN'))} · ${rows.length} record${rows.length === 1 ? '' : 's'}</div>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  await RNPrint.print({ html });
}

async function writeExcel(
  headers: { key: string; label: string }[],
  rows: any[],
  filename: string,
  sheetName: string,
) {
  const headerRow = headers.map(h => h.label);
  const dataRows = rows.map(row =>
    headers.map(h => {
      const val = row[h.key];
      return val === undefined || val === null ? '' : val;
    }),
  );
  await writeAndShareWorkbook([headerRow, ...dataRows], filename, sheetName);
}

// Every list/report "download" in the app goes through here, so each one now
// offers both Excel and PDF.
export function exportRowsToExcel(
  headers: { key: string; label: string }[],
  rows: any[],
  filename: string,
  sheetName = 'Sheet1',
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    Alert.alert('Download report', 'Choose a format', [
      {
        text: 'Excel (.xlsx)',
        onPress: () =>
          writeExcel(headers, rows, filename, sheetName).then(resolve, reject),
      },
      {
        text: 'PDF',
        onPress: () =>
          printRowsAsPDF(headers, rows, filename).then(resolve, reject),
      },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
    ]);
  });
}

async function writeAndShareWorkbook(
  rows: unknown[][],
  filename: string,
  sheetName: string,
) {
  const base64 = buildXlsxBase64(rows, sheetName);
  const path = `${RNFS.CachesDirectoryPath}/${filename}`;
  await RNFS.writeFile(path, base64, 'base64');
  await Share.open({
    url: `file://${path}`,
    type: XLSX_MIME,
    filename,
    failOnCancel: false,
  });
}
