import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import payrollChequePdf from "../../assets/payrollcheque.pdf";
import * as pdfjsLib from "pdfjs-dist";
import jsPDF from "jspdf";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();
import { AppLayout } from "@/components/layout/AppLayout";
import {
  payrollAPI,
  employeeAPI,
  payrollPreviewAPI,
  settingsAPI,
} from "@/services/api";
import { Payroll } from "@/types/hrms";
import { cn, formatCurrency } from "@/lib/utils";
import {
  IndianRupee,
  Play,
  CheckCircle,
  X,
  Printer,
  Search,
  ArrowUp,
  ArrowDown,
  Eye,
} from "lucide-react";
import { ActionModal } from "@/components/ui/ActionModal";

// ── Indian number to words ───────────────────────────────────────────────────
function toIndianWords(n: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  if (n === 0) return "Zero";
  const twoDigit = (num: number): string => {
    if (num < 20) return ones[num];
    return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
  };
  let result = "";
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thou = Math.floor(n / 1000);
  n %= 1000;
  const hund = Math.floor(n / 100);
  n %= 100;
  if (crore) result += twoDigit(crore) + " Crore ";
  if (lakh) result += twoDigit(lakh) + " Lakh ";
  if (thou) result += twoDigit(thou) + " Thousand ";
  if (hund) result += ones[hund] + " Hundred ";
  if (n) result += twoDigit(n);
  return "Rupees " + result.trim() + " Only";
}

async function printPayslip(
  p: Payroll,
  co = {
    name: "",
    address: "",
    logo: "",
    chequeTemplate: "",
    chequeLogoX: 10,
    chequeLogoY: 20,
    chequeLogoSize: 60,
  },
) {
  const emp = p.employee as any;
  const net = Math.round(p.netSalary || 0);
  const fromDate = `01/${String(p.month).padStart(2, "0")}/${p.year}`;
  const lastDay = new Date(p.year, p.month, 0).getDate();
  const toDate = `${lastDay}/${String(p.month).padStart(2, "0")}/${p.year}`;
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm2 = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = String(today.getFullYear());

  // ── X / Y positions — tune these to match your PDF template fields ──
  const F = " 11px 'Segoe UI',Arial,sans-serif";
  const POS = {
    companyName: {
      x: 75,
      y: 30,
      font: "bold 13px 'Segoe UI',Arial,sans-serif",
    },
    companyAddr: { x: 75, y: 48, font: "11px 'Segoe UI',Arial,sans-serif" },
    // Date boxes: D D M M Y Y Y Y — tune each x to center in its box
    dateChars: [
      { x: 430, y: 36 },
      { x: 445, y: 36 },
      { x: 460, y: 36 },
      { x: 475, y: 36 },
      { x: 491, y: 36 },
      { x: 507, y: 36 },
      { x: 523, y: 36 },
      { x: 538, y: 36 },
    ],
    dateFont: F,
    empName: { x: 100, y: 120, font: F },
    empId: { x: 320, y: 120, font: F },
    designation: { x: 435, y: 120, font: F },
    amountWords: { x: 115, y: 145, font: "11px 'Segoe UI',Arial,sans-serif" },
    netAmount: {
      x: 440,
      y: 150,
      font: "bold 13px 'Segoe UI',Arial,sans-serif",
    },
    fromDate: { x: 250, y: 174, font: F },
    toDate: { x: 340, y: 174, font: F },
  };

  const drawValues = (ctx: CanvasRenderingContext2D, scale: number) => {
    const s = (v: number) => v * scale;
    ctx.fillStyle = "#000";

    const text = (
      pos: { x: number; y: number; font: string },
      value: string,
    ) => {
      ctx.font = pos.font.replace(
        /(\d+)px/,
        (_, n) => `${Math.round(+n * scale)}px`,
      );
      ctx.fillText(value, s(pos.x), s(pos.y));
    };

    const wrapText = (
      pos: { x: number; y: number; font: string },
      value: string,
      maxWidth: number,
      lineHeight: number,
    ) => {
      ctx.font = pos.font.replace(
        /(\d+)px/,
        (_, n) => `${Math.round(+n * scale)}px`,
      );
      const words = value.split(" ");
      let line = "";
      let y = s(pos.y);
      for (const word of words) {
        const test = line ? line + " " + word : word;
        if (ctx.measureText(test).width > s(maxWidth) && line) {
          ctx.fillText(line, s(pos.x), y);
          line = word;
          y += lineHeight * scale;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, s(pos.x), y);
    };

    text(POS.companyName, co.name);
    wrapText(POS.companyAddr, co.address, 300, 14);
    const dateStr = dd + mm2 + yyyy; // DDMMYYYY — 8 chars
    ctx.font = POS.dateFont.replace(
      /(\d+)px/,
      (_, n) => `${Math.round(+n * scale)}px`,
    );
    POS.dateChars.forEach((pos, i) => {
      ctx.fillText(dateStr[i] ?? "", s(pos.x), s(pos.y));
    });
    text(POS.empName, `${emp?.firstName ?? ""} ${emp?.lastName ?? ""}`);
    text(POS.empId, emp?.employeeId ?? "—");
    text(POS.designation, emp?.designation ?? "—");
    text(POS.amountWords, toIndianWords(net));
    text(POS.netAmount, net.toLocaleString("en-IN"));
    text(POS.fromDate, fromDate);
    text(POS.toDate, toDate);
  };

  const RENDER_SCALE = 2;
  const pdfDoc = await pdfjsLib.getDocument({ url: payrollChequePdf }).promise;
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx as any, canvas, viewport }).promise;
  if (co.logo) {
    await new Promise<void>((resolve) => {
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      logoImg.onload = () => {
        const drawW = co.chequeLogoSize * RENDER_SCALE;
        const drawH =
          logoImg.naturalHeight > 0
            ? (logoImg.naturalHeight / logoImg.naturalWidth) * drawW
            : drawW;
        ctx.drawImage(
          logoImg,
          co.chequeLogoX * RENDER_SCALE,
          co.chequeLogoY * RENDER_SCALE,
          drawW,
          drawH,
        );
        resolve();
      };
      logoImg.onerror = () => resolve();
      logoImg.src = co.logo;
    });
  }
  drawValues(ctx, RENDER_SCALE);
  const naturalW = viewport.width / RENDER_SCALE;
  const naturalH = viewport.height / RENDER_SCALE;
  const imgData = canvas.toDataURL("image/png");
  const orientation = naturalW > naturalH ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation,
    unit: "pt",
    format: [naturalW, naturalH],
  });
  pdf.addImage(imgData, "PNG", 0, 0, naturalW, naturalH);
  const empName =
    `${(p.employee as any)?.firstName ?? ""}_${(p.employee as any)?.lastName ?? ""}`.replace(
      /\s+/g,
      "_",
    );
  pdf.save(`Payslip_${empName}_${p.month}_${p.year}.pdf`);
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500 border-gray-300 px-2 py-0.5",
  processed: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB] px-2 py-0.5",
  paid: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C] px-2 py-0.5",
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processModal, setProcessModal] = useState(false);
  const [processMode, setProcessMode] = useState<"all" | "select">("all");
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(
    new Set(),
  );
  const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
  const [actionModal, setActionModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState<
    "employee" | "net" | "gross" | "deductions"
  >("employee");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewStep, setPreviewStep] = useState<"form" | "preview">("form");
  const [company, setCompany] = useState<{
    name: string;
    address: string;
    logo: string;
    chequeTemplate: string;
    chequeLogoX: number;
    chequeLogoY: number;
    chequeLogoSize: number; // width in pts; height auto from aspect ratio
  }>({
    name: "",
    address: "",
    logo: "",
    chequeTemplate: "",
    chequeLogoX: 10,
    chequeLogoY: 20,
    chequeLogoSize: 60,
  });
  const [logoSettingsOpen, setLogoSettingsOpen] = useState(false);
  const [logoSettingsSaving, setLogoSettingsSaving] = useState(false);
  const [paidModal, setPaidModal] = useState<{
    show: boolean;
    payrollId: string | null;
    isBulk: boolean;
  }>({ show: false, payrollId: null, isBulk: false });
  const [paymentMode, setPaymentMode] = useState("bank_transfer");

  const SERVER_ROOT =
    (import.meta.env.VITE_API_URL as string)?.replace(/\/api$/, "") ?? "";

  useEffect(() => {
    settingsAPI
      .get()
      .then((r) => {
        if (r?.data) {
          const rawLogo: string =
            r.data.logoUrl || r.data.logo || r.data.companyLogo || "";
          const logoUrl = rawLogo.startsWith("/uploads/")
            ? `${SERVER_ROOT}${rawLogo}`
            : rawLogo;
          setCompany({
            name: r.data.companyName || r.data.name || "",
            address: r.data.companyAddress || r.data.address || "",
            logo: logoUrl,
            chequeTemplate: r.data.payrollChequeTemplate || "",
            chequeLogoX: r.data.chequeLogoX ?? 10,
            chequeLogoY: r.data.chequeLogoY ?? 20,
            chequeLogoSize: r.data.chequeLogoW ?? 60,
          });
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payrollAPI.getAll({
        month: String(month),
        year: String(year),
        limit: "200",
      });
      if (res.success) setPayrolls(res.data);
    } catch {}
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const handleProcess = async (force = false) => {
    setProcessing(true);
    try {
      const selectedIds =
        processMode === "all" ? undefined : Array.from(selectedEmployees);
      const res = await payrollAPI.process({
        month,
        year,
        employeeIds: selectedIds,
        force,
      });
      setActionModal({
        show: true,
        type: "success",
        title: "Payroll Processed",
        message: res.message || "Payroll processed successfully.",
      });
      setTimeout(() => {
        setProcessModal(false);
        setSelectedEmployees(new Set());
        setProcessMode("all");
        load();
      }, 500);
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to process payroll",
      });
    }
    setProcessing(false);
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedEmployees(newSelected);
  };

  const toggleAllEmployees = () => {
    if (selectedEmployees.size === activeEmployees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(activeEmployees.map((e) => e._id)));
    }
  };

  const handleMarkSlipReceived = async (
    id: string,
    status: "received" | "not_received",
  ) => {
    console.log("[Payroll] markSlipReceived →", id, status);
    try {
      const res = await payrollAPI.markSlipReceived(id, status);
      console.log("[Payroll] markSlipReceived response →", res);
      if (res.success) {
        setPayrolls((prev) =>
          prev.map((p) =>
            p._id === id
              ? {
                  ...p,
                  slipReceived: status,
                  slipReceivedAt: res.data?.slipReceivedAt,
                }
              : p,
          ),
        );
      }
    } catch (e: any) {
      console.error("[Payroll] markSlipReceived error →", e.message);
      alert(e.message);
    }
  };

  const handleMarkPaid = (id: string) => {
    setPaymentMode("bank_transfer");
    setPaidModal({ show: true, payrollId: id, isBulk: false });
  };

  const confirmMarkPaid = async () => {
    try {
      if (paidModal.isBulk) {
        await payrollAPI.bulkMarkPaid(month, year, paymentMode);
      } else {
        await payrollAPI.markPaid(paidModal.payrollId!, paymentMode);
      }
      load();
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message,
      });
    } finally {
      setPaidModal({ show: false, payrollId: null, isBulk: false });
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const selectedIds =
        processMode === "all" ? undefined : Array.from(selectedEmployees);
      const res = await payrollPreviewAPI.preview({
        month,
        year,
        employeeIds: selectedIds,
      });
      setPreviewData(res.data || []);
      setPreviewStep("preview");
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Preview Failed",
        message: err.message,
      });
    }
    setPreviewing(false);
  };

  const totalGross = payrolls.reduce((s, p) => s + p.grossSalary, 0);
  const totalNet = payrolls.reduce((s, p) => s + p.netSalary, 0);
  const totalDed = payrolls.reduce((s, p) => s + p.totalDeductions, 0);
  const paidCount = payrolls.filter((p) => p.status === "paid").length;

  const displayedPayrolls = [...payrolls]
    .filter((p) => {
      const name =
        `${(p.employee as any)?.firstName ?? ""} ${(p.employee as any)?.lastName ?? ""}`.toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "employee") {
        const na = `${(a.employee as any)?.firstName ?? ""}${(a.employee as any)?.lastName ?? ""}`;
        const nb = `${(b.employee as any)?.firstName ?? ""}${(b.employee as any)?.lastName ?? ""}`;
        cmp = na.localeCompare(nb);
      } else if (sortKey === "net") cmp = a.netSalary - b.netSalary;
      else if (sortKey === "gross") cmp = a.grossSalary - b.grossSalary;
      else if (sortKey === "deductions")
        cmp = a.totalDeductions - b.totalDeductions;
      return sortDir === "asc" ? cmp : -cmp;
    });

  return (
    <AppLayout title="Payroll">
      {}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border-2 border-black px-3 py-2 text-sm font-semibold outline-none bg-white"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border-2 border-black px-3 py-2 text-sm font-semibold outline-none bg-white"
          >
            {Array.from(
              { length: 5 },
              (_, i) => new Date().getFullYear() - 2 + i,
            ).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setPaymentMode("bank_transfer");
              setPaidModal({ show: true, payrollId: null, isBulk: true });
            }}
            disabled={
              payrolls.filter((p) => p.status === "processed").length === 0
            }
            className="border-2 bg-[#00C48C] text-white px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-40"
          >
            <CheckCircle className="w-4 h-4" /> Bulk Mark Paid
          </button>
          <button
            onClick={() => {
              if (payrolls.length === 0) {
                alert("No payroll records to print.");
                return;
              }
              const win = window.open("", "_blank");
              if (!win) return;
              const rows = payrolls
                .map(
                  (p) =>
                    `<tr><td>${(p.employee as any)?.firstName} ${(p.employee as any)?.lastName}</td><td>${(p.employee as any)?.designation}</td><td>₹${p.basicSalary.toLocaleString()}</td><td>₹${p.grossSalary.toLocaleString()}</td><td>-₹${p.totalDeductions.toLocaleString()}</td><td>₹${p.netSalary.toLocaleString()}</td><td>${p.status}</td></tr>`,
                )
                .join("");
              win.document.write(
                `<html><head><title>Salary Slips ${MONTHS[month - 1]} ${year}</title><style>@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');body{font-family:"DM Sans",sans-serif;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px}th{background:#f0f6ff}</style></head><body><h2>Payroll — ${MONTHS[month - 1]} ${year}</h2><table><thead><tr><th>Employee</th><th>Designation</th><th>Basic</th><th>Gross</th><th>Deductions</th><th>Net Pay</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`,
              );
              win.document.close();
              win.print();
            }}
            className="bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 border-2 border-black"
          >
            <Printer className="w-4 h-4" /> Bulk Slips
          </button>
          <button
            onClick={() => {
              setProcessModal(true);
              employeeAPI
                .getAll({ status: "active" })
                .then((res) => {
                  if (res.success) setActiveEmployees(res.data);
                })
                .catch(() => {});
            }}
            className="border-2 bg-[#FA731C] text-white px-4 py-2 text-sm flex items-center gap-1.5"
          >
            <Play className="w-4 h-4" /> Run Payroll
          </button>
        </div>
      </div>

      {}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          {
            label: "Gross Salary",
            value: formatCurrency(totalGross),
            bg: "bg-[#024BAB]",
          },
          {
            label: "Total Deductions",
            value: formatCurrency(totalDed),
            bg: "bg-[#FA731C]",
          },
          {
            label: "Net Payable",
            value: formatCurrency(totalNet),
            bg: "bg-[#00C48C]",
          },
          {
            label: "Paid",
            value: `${paidCount}/${payrolls.length}`,
            bg: "bg-[#024BAB]",
          },
        ].map(({ label, value, bg }) => (
          <div key={label} className="border-2 bg-white p-4">
            <div
              className={cn(
                "w-10 h-10 border-2 border-black flex items-center justify-center mb-2",
                bg,
              )}
            >
              <IndianRupee className="w-5 h-5 text-white" />
            </div>
            <p className="font-display font-bold text-lg text-black">{value}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Cheque logo position settings */}
      {company.logo && (
        <div className="border-2 border-black bg-white mb-5">
          <button
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-wider"
            onClick={() => setLogoSettingsOpen((v) => !v)}
          >
            <span>Cheque Logo Position</span>
            <span className="text-muted-foreground">
              {logoSettingsOpen ? "▲" : "▼"}
            </span>
          </button>
          {logoSettingsOpen && (
            <div className="px-4 pb-4 border-t-2 border-black">
              <div className="flex items-start gap-4 mt-3">
                <img
                  src={company.logo}
                  alt="logo"
                  className="w-16 h-16 object-contain border border-gray-300 bg-white p-1 shrink-0"
                />
                <div className="flex gap-3 flex-wrap items-end flex-1">
                  {[
                    { label: "X (pts)", key: "chequeLogoX" },
                    { label: "Y (pts)", key: "chequeLogoY" },
                    { label: "Size (width pts)", key: "chequeLogoSize" },
                  ].map(({ label, key }) => (
                    <div key={key} className="space-y-1">
                      <label className="block text-xs font-bold text-black uppercase tracking-wider">
                        {label}
                      </label>
                      <input
                        type="number"
                        value={(company as any)[key]}
                        onChange={(e) =>
                          setCompany((prev) => ({
                            ...prev,
                            [key]: Number(e.target.value),
                          }))
                        }
                        className="w-24 px-2 py-1 border-2 border-black text-xs font-mono focus:outline-none focus:border-[#024BAB]"
                      />
                    </div>
                  ))}
                  <button
                    disabled={logoSettingsSaving}
                    onClick={async () => {
                      setLogoSettingsSaving(true);
                      try {
                        await settingsAPI.update({
                          chequeLogoX: company.chequeLogoX,
                          chequeLogoY: company.chequeLogoY,
                          chequeLogoW: company.chequeLogoSize,
                        });
                      } finally {
                        setLogoSettingsSaving(false);
                      }
                    }}
                    className="px-3 py-1 bg-[#024BAB] text-white text-xs font-bold border-2 border-black disabled:opacity-50"
                  >
                    {logoSettingsSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Height is auto-calculated from the logo's aspect ratio. Print a
                test payslip to fine-tune.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Search, Filter & Sort */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by employee name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full font-medium"
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="processed">Processed</option>
          <option value="paid">Paid</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as any)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="employee">Sort: Employee</option>
          <option value="net">Sort: Net Pay</option>
          <option value="gross">Sort: Gross</option>
          <option value="deductions">Sort: Deductions</option>
        </select>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="border-2 border-black bg-white px-3 py-2 flex items-center gap-1 font-semibold text-sm"
        >
          {sortDir === "asc" ? (
            <ArrowUp className="w-4 h-4" />
          ) : (
            <ArrowDown className="w-4 h-4" />
          )}
          {sortDir === "asc" ? "Asc" : "Desc"}
        </button>
      </div>

      {}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : payrolls.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <IndianRupee className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No payroll records</p>
          <p className="text-sm text-muted-foreground mt-1">
            Process payroll for {MONTHS[month - 1]} {year}
          </p>
          <button
            onClick={() => {
              setProcessModal(true);
              employeeAPI
                .getAll({ status: "active" })
                .then((res) => {
                  if (res.success) setActiveEmployees(res.data);
                })
                .catch(() => {});
            }}
            className="border-2 bg-[#FA731C] text-white px-4 py-2 text-sm mt-4"
          >
            <Play className="w-4 h-4 inline mr-1" /> Process Now
          </button>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  { label: "Employee", cls: "" },
                  { label: "Salary", cls: "text-right" },
                  { label: "OT", cls: "text-right text-[#F59E0B]" },
                  { label: "Absent", cls: "text-right text-red-500" },
                  { label: "Late", cls: "text-right text-red-500" },
                  { label: "Half Day", cls: "text-right text-red-500" },
                  { label: "Early Out", cls: "text-right text-red-500" },
                  { label: "Penalty", cls: "text-right text-red-500" },
                  { label: "Bonus / Allow", cls: "text-right text-[#00C48C]" },
                  { label: "Loan / Advance", cls: "text-right text-[#FA731C]" },
                  { label: "Net Salary", cls: "text-right" },
                  { label: "Status", cls: "" },
                  { label: "", cls: "" },
                ].map(({ label, cls }) => (
                  <th
                    key={label}
                    className={cn(
                      "px-4 py-3 text-xs font-bold text-black uppercase tracking-wider",
                      cls,
                    )}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedPayrolls.map((p, i) => (
                <tr
                  key={p._id}
                  className={cn(
                    "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                    i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                  )}
                >
                  {}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {(p.employee as any)?.avatar ? (
                        <img
                          src={(p.employee as any).avatar}
                          alt={(p.employee as any)?.firstName}
                          className="w-7 h-7 border-2 border-black object-cover shrink-0 rounded-full"
                        />
                      ) : (
                        <div className="w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[10px] font-bold text-white shrink-0 rounded-full">
                          {(p.employee as any)?.firstName?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-black text-xs">
                          {(p.employee as any)?.firstName}{" "}
                          {(p.employee as any)?.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {p.totalWorkHours != null
                            ? `${Number(p.totalWorkHours).toFixed(2)}h worked`
                            : `${p.presentDays}/${p.workingDays} days`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          ₹{p.hourlyRate?.toFixed(2) ?? "—"}/hr
                        </p>
                      </div>
                    </div>
                  </td>

                  {}
                  <td className="px-4 py-3 text-right">
                    <p className="text-xs font-bold text-black">
                      {formatCurrency(p.earnedBasic ?? p.basicSalary)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      of {formatCurrency(p.basicSalary)}
                    </p>
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {(p.otPay ?? 0) > 0 ? (
                      <span className="text-[#F59E0B]">
                        +{formatCurrency(p.otPay!)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {(p.overtimeHours ?? 0) > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        {Number(p.overtimeHours).toFixed(2)}h
                      </p>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {(p as any).absentDeduction > 0 ? (
                      <span className="text-red-500">
                        -{formatCurrency((p as any).absentDeduction)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {(p as any).absentDays > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        {(p as any).absentDays}d
                      </p>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {(p.lateDeductionAmount ?? 0) > 0 ? (
                      <span className="text-red-500">
                        -{formatCurrency(p.lateDeductionAmount!)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {(p.halfDayDeduction ?? 0) > 0 ? (
                      <span className="text-red-500">
                        -{formatCurrency(p.halfDayDeduction!)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {(p.earlyCheckoutDeduction ?? 0) > 0 ? (
                      <span className="text-red-500">
                        -{formatCurrency(p.earlyCheckoutDeduction!)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {(p.penaltyAmount ?? 0) > 0 ? (
                      <span className="text-red-500">
                        -{formatCurrency(p.penaltyAmount!)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {(p.otherAllowances ?? 0) > 0 ? (
                      <span className="text-[#00C48C]">
                        +{formatCurrency(p.otherAllowances!)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {p.loanDeduction > 0 ? (
                      <span className="text-[#FA731C]">
                        -{formatCurrency(p.loanDeduction)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {}
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "text-sm font-bold",
                        p.netSalary === 0 ? "text-red-500" : "text-black",
                      )}
                    >
                      {formatCurrency(p.netSalary)}
                    </span>
                  </td>

                  {}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "border-2 text-[10px] capitalize",
                        STATUS_COLORS[p.status],
                      )}
                    >
                      {p.status}
                    </span>
                  </td>

                  {}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {p.status === "processed" && (
                        <button
                          onClick={() => handleMarkPaid(p._id)}
                          className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-1 hover:bg-[#024BAB] hover:text-white transition-colors whitespace-nowrap"
                        >
                          <CheckCircle className="w-3 h-3" /> Mark Paid
                        </button>
                      )}
                      {p.status === "paid" && (
                        <span className="text-xs text-[#00C48C] font-bold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Paid
                        </span>
                      )}
                      <button
                        onClick={() => printPayslip(p, company)}
                        className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white transition-colors whitespace-nowrap"
                      >
                        <Printer className="w-3 h-3" /> Payslip
                      </button>
                      {/* Slip receipt confirmation */}
                      {p.slipReceived === "received" ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-[#00C48C] border-2 border-[#00C48C] px-2 py-0.5">
                          <CheckCircle className="w-3 h-3" /> RECEIVED
                        </span>
                      ) : p.slipReceived === "not_received" ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 border-2 border-red-400 px-2 py-0.5">
                          <X className="w-3 h-3" /> NOT RECEIVED
                        </span>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() =>
                              handleMarkSlipReceived(p._id, "received")
                            }
                            className="flex items-center gap-0.5 text-[10px] font-bold border-2 border-[#00C48C] text-[#00C48C] px-1.5 py-0.5 hover:bg-[#00C48C] hover:text-white transition-colors whitespace-nowrap"
                            title="Employee received the payslip"
                          >
                            <CheckCircle className="w-2.5 h-2.5" /> Received
                          </button>
                          <button
                            onClick={() =>
                              handleMarkSlipReceived(p._id, "not_received")
                            }
                            className="flex items-center gap-0.5 text-[10px] font-bold border-2 border-red-400 text-red-500 px-1.5 py-0.5 hover:bg-red-500 hover:text-white transition-colors whitespace-nowrap"
                            title="Employee has not received the payslip"
                          >
                            <X className="w-2.5 h-2.5" /> Not Rcvd
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {}
      {processModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b-2 border-black sticky top-0 bg-white">
              <h3 className="font-display font-bold text-lg">
                {previewStep === "preview"
                  ? "Payroll Preview"
                  : "Process Payroll"}
              </h3>
              <button
                onClick={() => {
                  setProcessModal(false);
                  setSelectedEmployees(new Set());
                  setProcessMode("all");
                  setActiveEmployees([]);
                  setPreviewStep("form");
                  setPreviewData([]);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm font-medium text-black mb-4">
                Process payroll for{" "}
                <strong>
                  {MONTHS[month - 1]} {year}
                </strong>
              </p>

              {}
              <div className="space-y-3 mb-6">
                <label
                  className="flex items-center gap-3 p-3 border-2 border-black cursor-pointer hover:bg-[#024BAB]/5 transition-colors"
                  onClick={() => setProcessMode("all")}
                >
                  <input
                    type="radio"
                    name="processMode"
                    value="all"
                    checked={processMode === "all"}
                    onChange={() => setProcessMode("all")}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-bold text-black">
                      All Employees
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Process payroll for all {activeEmployees.length} active
                      employees
                    </p>
                  </div>
                </label>

                <label
                  className="flex items-center gap-3 p-3 border-2 border-black cursor-pointer hover:bg-[#024BAB]/5 transition-colors"
                  onClick={() => setProcessMode("select")}
                >
                  <input
                    type="radio"
                    name="processMode"
                    value="select"
                    checked={processMode === "select"}
                    onChange={() => setProcessMode("select")}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-bold text-black">
                      Custom Selection
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Choose specific employees
                    </p>
                  </div>
                </label>
              </div>

              {}
              {processMode === "select" && (
                <div className="mb-6 p-4 border-2 border-black bg-[#F8FAFF]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-black uppercase tracking-wider">
                      Select Employees
                    </p>
                    <button
                      onClick={toggleAllEmployees}
                      className="text-xs font-bold text-[#024BAB] hover:underline"
                    >
                      {selectedEmployees.size === activeEmployees.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {activeEmployees.map((emp) => (
                      <label
                        key={emp._id}
                        className="flex items-center gap-2 p-2 hover:bg-white/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmployees.has(emp._id)}
                          onChange={() => toggleEmployeeSelection(emp._id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          {emp.avatar ? (
                            <img
                              src={emp.avatar}
                              alt={emp.firstName}
                              className="w-6 h-6 border-2 border-black object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-6 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                              {emp.firstName?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-bold text-black">
                              {emp.firstName} {emp.lastName}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {emp.designation}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs font-medium text-black">
                          {formatCurrency(emp.salary || 0)}
                        </p>
                      </label>
                    ))}
                    {activeEmployees.length === 0 && (
                      <p className="text-xs text-center text-muted-foreground py-4">
                        Loading employees...
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    {selectedEmployees.size} of {activeEmployees.length}{" "}
                    selected
                  </p>
                </div>
              )}

              {}
              <div className="p-3 border-2 border-[#FA731C] bg-[#FA731C]/5 mb-4">
                <p className="text-xs font-bold text-[#FA731C]">
                  ⚠ Existing records won't be overwritten. Verify selection
                  before processing.
                </p>
              </div>

              {previewStep === "preview" && previewData.length > 0 && (
                <div className="mb-4 border-2 border-black overflow-auto max-h-64">
                  <table className="w-full text-xs min-w-[500px]">
                    <thead>
                      <tr className="bg-[#024BAB]/10 border-b-2 border-black">
                        <th className="px-3 py-2 text-left font-bold">
                          Employee
                        </th>
                        <th className="px-3 py-2 text-right font-bold">
                          Gross
                        </th>
                        <th className="px-3 py-2 text-right font-bold text-red-500">
                          Deductions
                        </th>
                        <th className="px-3 py-2 text-right font-bold">
                          Net Pay
                        </th>
                        <th className="px-3 py-2 text-center font-bold">
                          Days
                        </th>
                        <th className="px-3 py-2 text-center font-bold">
                          Note
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((p) => (
                        <tr
                          key={p.employee._id}
                          className="border-b border-black/10"
                        >
                          <td className="px-3 py-2 font-semibold">
                            {p.employee.firstName} {p.employee.lastName}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatCurrency(p.grossSalary)}
                          </td>
                          <td className="px-3 py-2 text-right text-red-500">
                            -{formatCurrency(p.totalDeductions)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">
                            {formatCurrency(p.netSalary)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {p.presentDays}/{p.workingDays}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {p.alreadyProcessed ? (
                              <span className="text-[#FA731C] font-bold">
                                Exists
                              </span>
                            ) : (
                              <span className="text-[#00C48C] font-bold">
                                New
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 flex-wrap">
                {previewStep === "form" ? (
                  <>
                    <button
                      onClick={handlePreview}
                      disabled={
                        previewing ||
                        (processMode === "select" &&
                          selectedEmployees.size === 0)
                      }
                      className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Eye className="w-4 h-4" />{" "}
                      {previewing ? "Loading Preview..." : "Preview"}
                    </button>
                    <button
                      onClick={() => handleProcess(false)}
                      disabled={
                        processing ||
                        (processMode === "select" &&
                          selectedEmployees.size === 0)
                      }
                      className="border-2 bg-[#FA731C] text-white px-6 py-2.5 text-sm font-bold flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing ? "Processing..." : "Confirm & Process"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setPreviewStep("form");
                        setPreviewData([]);
                      }}
                      className="border-2 border-black bg-white text-black px-4 py-2.5 text-sm font-bold"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => handleProcess(false)}
                      disabled={processing}
                      className="border-2 bg-[#FA731C] text-white px-6 py-2.5 text-sm font-bold flex-1 disabled:opacity-50"
                    >
                      {processing ? "Processing..." : "Confirm & Process"}
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    if (
                      !confirm(
                        `Force reprocess will DELETE existing payroll for ${month}/${year} (not paid) and recalculate. Continue?`,
                      )
                    )
                      return;
                    handleProcess(true);
                  }}
                  disabled={processing}
                  className="border-2 bg-red-600 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                >
                  Force Reprocess
                </button>
                <button
                  onClick={() => {
                    setProcessModal(false);
                    setSelectedEmployees(new Set());
                    setProcessMode("all");
                    setActiveEmployees([]);
                    setPreviewStep("form");
                    setPreviewData([]);
                  }}
                  className="bg-white text-black px-4 py-2.5 text-sm font-bold border-2 border-black"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Mode Modal */}
      {paidModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 border-black bg-white w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b-2 border-black">
              <h3 className="font-display font-bold text-base">
                {paidModal.isBulk ? "Bulk Mark as Paid" : "Mark as Paid"}
              </h3>
              <button
                onClick={() =>
                  setPaidModal({ show: false, payrollId: null, isBulk: false })
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                {paidModal.isBulk
                  ? `Mark all processed payrolls as PAID for ${MONTHS[month - 1]} ${year}.`
                  : "Confirm payment details before sending the WhatsApp notification with payslip PDF."}
              </p>
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                  Mode of Payment
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full border-2 border-black px-3 py-2 text-sm font-semibold outline-none bg-white focus:border-[#024BAB]"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={confirmMarkPaid}
                  className="flex-1 bg-[#00C48C] text-white border-2 border-black px-4 py-2 text-sm font-bold flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Confirm & Mark Paid
                </button>
                <button
                  onClick={() =>
                    setPaidModal({
                      show: false,
                      payrollId: null,
                      isBulk: false,
                    })
                  }
                  className="px-4 py-2 border-2 border-black text-sm font-bold bg-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ActionModal
        show={actionModal.show}
        type={actionModal.type}
        title={actionModal.title}
        message={actionModal.message}
        onClose={() => setActionModal({ ...actionModal, show: false })}
      />
    </AppLayout>
  );
}
