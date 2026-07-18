import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  downloadImportTemplate,
  parseImportFile,
  type ImportHeader,
} from "@/utils/excelImportExport";

export type { ImportHeader };

interface ImportResult {
  imported: number;
  failed: number;
  results: { row: number; status: "success" | "error"; message?: string }[];
}

interface PreviewColumn {
  key: string;
  label: string;
  render?: (row: Record<string, string>) => React.ReactNode;
}

interface ImportExportModalProps {
  open: boolean;
  onClose: () => void;
  entityLabel: string; // singular, e.g. "Employee", "Student"
  headers: ImportHeader[];
  templateFilename: string;
  notes?: React.ReactNode;
  previewColumns: PreviewColumn[];
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
  onImported?: () => void;
}

// Generic 3-step (guide → preview → result) Excel import modal, matching
// the neo-brutalist black-border style used across the app. Originally
// inline in EmployeesPage.tsx; extracted so every entity page can reuse it.
export function ImportExportModal({
  open,
  onClose,
  entityLabel,
  headers,
  templateFilename,
  notes,
  previewColumns,
  onImport,
  onImported,
}: ImportExportModalProps) {
  const [step, setStep] = useState<"guide" | "preview" | "result">("guide");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const close = () => {
    onClose();
    setStep("guide");
    setRows([]);
    setResult(null);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = await parseImportFile(file, headers);
      if (parsed.length === 0) {
        alert("Sheet is empty or has no data rows.");
        return;
      }
      setRows(parsed);
      setStep("preview");
    } catch {
      alert("Could not read that file. Please upload a valid .xlsx/.xls file.");
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await onImport(rows);
      setResult(res);
      setStep("result");
      if (res.imported > 0) onImported?.();
    } catch (err: any) {
      alert(err.message || "Import failed");
    }
    setImporting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-black w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#024BAB]" />
            <h2 className="font-bold text-lg text-black">
              {step === "guide" && `Import ${entityLabel}s via Excel`}
              {step === "preview" &&
                `Preview — ${rows.length} row${rows.length !== 1 ? "s" : ""} found`}
              {step === "result" && "Import Complete"}
            </h2>
          </div>
          <button onClick={close}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {step === "guide" && (
            <>
              <div className="bg-[#F0F6FF] border-2 border-[#024BAB] p-4 text-sm text-[#024BAB] font-medium">
                Prepare your Excel file with the columns listed below.
                Download the template to get started instantly.
              </div>

              <div className="border-2 border-black overflow-hidden">
                <div className="grid grid-cols-[1fr_80px_1fr] bg-[#024BAB] text-white text-xs font-bold uppercase px-3 py-2">
                  <span>Column Header (exact)</span>
                  <span>Required</span>
                  <span>Example Value</span>
                </div>
                {headers.map((h) => (
                  <div
                    key={h.key}
                    className="grid grid-cols-[1fr_80px_1fr] px-3 py-2 border-t border-black/10 text-sm hover:bg-gray-50"
                  >
                    <span className="font-bold text-black">{h.label}</span>
                    <span
                      className={cn(
                        "text-xs font-bold",
                        h.required ? "text-[#EF4444]" : "text-gray-400",
                      )}
                    >
                      {h.required ? "Yes" : "No"}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {h.example}
                    </span>
                  </div>
                ))}
              </div>

              {notes && (
                <div className="bg-amber-50 border-2 border-amber-400 p-3 text-xs font-medium text-amber-800 space-y-1">
                  <p className="font-bold">Notes:</p>
                  {notes}
                </div>
              )}
            </>
          )}

          {step === "preview" && (
            <>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No data rows found in the file.
                </p>
              ) : (
                <div className="border-2 border-black overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#024BAB]/5 border-b-2 border-black">
                        <th className="px-3 py-2 text-left font-bold">#</th>
                        {previewColumns.map((c) => (
                          <th
                            key={c.key}
                            className="px-3 py-2 text-left font-bold"
                          >
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr
                          key={i}
                          className="border-t border-black/10 hover:bg-gray-50"
                        >
                          <td className="px-3 py-2 text-muted-foreground">
                            {i + 1}
                          </td>
                          {previewColumns.map((c) => (
                            <td key={c.key} className="px-3 py-2">
                              {c.render ? c.render(r) : r[c.key] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {step === "result" && result && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="border-2 border-[#00C48C] bg-[#00C48C]/10 p-4 text-center">
                  <p className="text-3xl font-bold text-[#00C48C]">
                    {result.imported}
                  </p>
                  <p className="text-xs font-bold text-[#00C48C] mt-1">
                    Successfully Imported
                  </p>
                </div>
                <div className="border-2 border-[#EF4444] bg-[#EF4444]/10 p-4 text-center">
                  <p className="text-3xl font-bold text-[#EF4444]">
                    {result.failed}
                  </p>
                  <p className="text-xs font-bold text-[#EF4444] mt-1">
                    Failed
                  </p>
                </div>
              </div>

              {result.failed > 0 && (
                <div className="border-2 border-black overflow-hidden">
                  <div className="bg-[#EF4444] text-white text-xs font-bold px-3 py-2">
                    Failed Rows
                  </div>
                  {result.results
                    .filter((r) => r.status === "error")
                    .map((r) => (
                      <div
                        key={r.row}
                        className="flex items-start gap-3 px-3 py-2 border-t border-black/10 text-sm"
                      >
                        <span className="font-bold text-[#EF4444] shrink-0">
                          Row {r.row}
                        </span>
                        <span className="text-muted-foreground">
                          {r.message}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t-2 border-black flex items-center gap-3 shrink-0">
          {step === "guide" && (
            <>
              <button
                onClick={() => downloadImportTemplate(headers, templateFilename)}
                className="border-2 border-black px-4 py-2 text-sm font-bold flex items-center gap-1.5 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" /> Download Template
              </button>
              <label className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold flex items-center gap-1.5 cursor-pointer hover:bg-[#01368A]">
                <Upload className="w-4 h-4" /> Choose Excel File
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFile}
                />
              </label>
              <button
                onClick={close}
                className="ml-auto text-sm font-bold text-muted-foreground hover:text-black"
              >
                Cancel
              </button>
            </>
          )}

          {step === "preview" && (
            <>
              <button
                onClick={() => setStep("guide")}
                className="border-2 border-black px-4 py-2 text-sm font-bold hover:bg-gray-50"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing || rows.length === 0}
                className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold flex items-center gap-2 hover:bg-[#01368A] disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Importing…
                  </>
                ) : (
                  `Import ${rows.length} ${entityLabel}${rows.length !== 1 ? "s" : ""}`
                )}
              </button>
              <button
                onClick={close}
                className="ml-auto text-sm font-bold text-muted-foreground hover:text-black"
              >
                Cancel
              </button>
            </>
          )}

          {step === "result" && (
            <button
              onClick={close}
              className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold hover:bg-[#01368A]"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
