import { useState, useRef, useEffect, type ReactNode } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { exportExcel, exportPdf, type ExportCol } from "@/lib/exporters";

export interface ExportExtra {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface Props<T> {
  name: string;
  cols: ExportCol<T>[];
  rows: T[];
  /** Pass false to offer Excel only. */
  pdf?: boolean;
  /** Extra entries listed under Excel / PDF (e.g. accounting exports), separated by a rule. */
  extra?: ExportExtra[];
}

export function ExportMenu<T>({
  name,
  cols,
  rows,
  pdf = true,
  extra,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) =>
      !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const item =
    "w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-left hover:bg-[#024BAB]/10";
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50"
      >
        <Download className="w-4 h-4" /> Export
      </button>
      {open && (
        <div
          className={`absolute right-0 mt-1 bg-white border-2 border-black z-30 ${extra?.length ? "w-52" : "w-40"}`}
        >
          <button
            className={item}
            onClick={() => {
              exportExcel(name, cols, rows);
              setOpen(false);
            }}
          >
            <FileSpreadsheet className="w-4 h-4 text-[#00A36C]" /> Excel (.xlsx)
          </button>
          {pdf && (
            <button
              className={item}
              onClick={() => {
                exportPdf(name, cols, rows);
                setOpen(false);
              }}
            >
              <FileText className="w-4 h-4 text-[#EF4444]" /> PDF
            </button>
          )}
          {extra && extra.length > 0 && (
            <div className="border-t-2 border-black/10">
              {extra.map((x) => (
                <button
                  key={x.label}
                  disabled={x.disabled}
                  className={`${item} disabled:opacity-40 disabled:cursor-not-allowed`}
                  onClick={() => {
                    x.onClick();
                    setOpen(false);
                  }}
                >
                  {x.icon} {x.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
