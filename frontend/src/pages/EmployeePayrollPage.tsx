import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { payrollAPI } from "@/services/api";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  IndianRupee,
  Calendar,
  Download,
  Loader2,
  FileText,
  CheckCircle,
  Clock,
} from "lucide-react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const YEARS = Array.from(
  { length: 4 },
  (_, i) => new Date().getFullYear() - 1 + i,
);

interface PayrollRecord {
  _id: string;
  month: number;
  year: number;
  basicSalary: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  workingDays: number;
  presentDays: number;
  leaveDays?: number;
  status: "draft" | "processed" | "paid";
  paidAt?: string;
}

function formatCurrency(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: {
      label: "Paid",
      cls: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
    },
    processed: {
      label: "Processed",
      cls: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]",
    },
    draft: { label: "Draft", cls: "bg-gray-100 text-gray-500 border-gray-300" },
  };
  const { label, cls } = map[status] ?? map.draft;
  return (
    <span
      className={`text-[10px] font-bold uppercase border-2 px-2 py-0.5 ${cls}`}
    >
      {label}
    </span>
  );
}

export default function EmployeePayrollPage() {
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payrollAPI.getMy({ year: String(filterYear) });
      if (res.success) setPayrolls(res.data);
    } catch {
      setPayrolls([]);
    } finally {
      setLoading(false);
    }
  }, [filterYear]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = (p: PayrollRecord) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
      <head><title>Salary Slip — ${MONTHS[p.month - 1]} ${p.year}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        body { font-family: "DM Sans", Arial, sans-serif; font-size: 13px; padding: 32px; color: #000; }
        h2 { font-size: 18px; margin-bottom: 4px; }
        .subtitle { color: #666; margin-bottom: 24px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
        th { background: #f0f6ff; font-size: 11px; text-transform: uppercase; }
        .total { font-weight: bold; background: #f8f8f8; }
        .net { font-size: 16px; font-weight: bold; color: #024BAB; }
        @media print { button { display: none; } }
      </style>
      </head>
      <body>
        <h2>Salary Slip</h2>
        <p class="subtitle">${MONTHS[p.month - 1]} ${p.year} · Status: ${p.status.toUpperCase()}</p>
        <table>
          <tr><th>Component</th><th>Amount</th></tr>
          <tr><td>Basic Salary (Monthly)</td><td>${formatCurrency(p.basicSalary)}</td></tr>
          <tr class="total"><td>Gross Salary</td><td>${formatCurrency(p.grossSalary)}</td></tr>
          <tr><td>Deductions</td><td>- ${formatCurrency(p.totalDeductions)}</td></tr>
          <tr class="total net"><td>Net Pay</td><td>${formatCurrency(p.netSalary)}</td></tr>
        </table>
        <table>
          <tr><th>Attendance</th><th>Days</th></tr>
          <tr><td>Working Days (${p.workingDays})</td><td>—</td></tr>
          <tr><td>Days Present</td><td>${p.presentDays}</td></tr>
          ${p.paidAt ? `<tr><td>Paid On</td><td>${new Date(p.paidAt).toLocaleDateString("en-IN")}</td></tr>` : ""}
        </table>
        <button onclick="window.print()">Print</button>
      </body></html>
    `);
    win.document.close();
  };

  const totalEarned = payrolls
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.netSalary, 0);

  return (
    <AppLayout title="My Payroll">
      <div className="w-full mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-3xl text-black">
              My Payroll
            </h1>
            <p className="text-gray-600 font-medium mt-1">
              Your salary slips and payment history
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="border-2 border-black px-3 py-2 text-sm font-bold bg-white focus:outline-none"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {}
        {payrolls.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              {
                label: "Total Earned",
                value: formatCurrency(totalEarned),
                icon: IndianRupee,
                color: "text-[#00C48C]",
              },
              {
                label: "Slips This Year",
                value: String(payrolls.length),
                icon: FileText,
                color: "text-[#024BAB]",
              },
              {
                label: "Last Paid",
                value: payrolls.find((p) => p.status === "paid")
                  ? `${MONTHS[payrolls.find((p) => p.status === "paid")!.month - 1].slice(0, 3)} ${payrolls.find((p) => p.status === "paid")!.year}`
                  : "—",
                icon: CheckCircle,
                color: "text-[#FA731C]",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="bg-white border-2 border-black p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-[#F0F6FF] border-2 border-black flex items-center justify-center shrink-0">
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-500">
                    {label}
                  </p>
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
          </div>
        ) : payrolls.length === 0 ? (
          <div className="border-2 border-black bg-white p-12 text-center">
            <IndianRupee className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-bold text-lg text-gray-500">
              No payroll records for {filterYear}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Your salary slips will appear here once payroll is processed
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {payrolls.map((p) => (
              <div
                key={p._id}
                className="bg-white border-2 border-black flex items-center justify-between px-5 py-4 gap-4"
              >
                {}
                <div className="flex items-center gap-3 min-w-[130px]">
                  <div className="w-10 h-10 bg-[#024BAB] border-2 border-black flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-white uppercase leading-none">
                      {MONTHS[p.month - 1].slice(0, 3)}
                    </span>
                    <span className="text-xs font-bold text-white leading-none">
                      {p.year}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-black">
                      {MONTHS[p.month - 1]} {p.year}
                    </p>
                    <StatusBadge status={p.status} />
                  </div>
                </div>

                {}
                <div className="hidden sm:flex items-center gap-1 text-xs text-gray-600">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="font-bold">{p.presentDays}</span>
                  <span className="text-gray-400">/ {p.workingDays} days</span>
                </div>

                {}
                <div className="flex gap-6 items-center">
                  <div className="text-center hidden md:block">
                    <p className="text-[10px] font-bold uppercase text-gray-400">
                      Gross
                    </p>
                    <p className="text-sm font-bold text-black">
                      {formatCurrency(p.grossSalary)}
                    </p>
                  </div>
                  <div className="text-center hidden md:block">
                    <p className="text-[10px] font-bold uppercase text-red-400">
                      Deductions
                    </p>
                    <p className="text-sm font-bold text-red-500">
                      -{formatCurrency(p.totalDeductions)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase text-[#00C48C]">
                      Net Pay
                    </p>
                    <p className="text-base font-bold text-[#00C48C]">
                      {formatCurrency(p.netSalary)}
                    </p>
                  </div>
                </div>

                {}
                <button
                  onClick={() => handlePrint(p)}
                  className="flex items-center gap-1.5 border-2 border-black px-3 py-2 text-xs font-bold hover:bg-[#024BAB] hover:text-white transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Slip
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
