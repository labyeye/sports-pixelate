import { useState, useEffect, useMemo } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { buildReportHTML, ReportCompany } from "@/lib/reportPrintHTML";
import * as XLSX from "xlsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  employeeAPI,
  attendanceAPI,
  payrollAPI,
  departmentAPI,
  leaveAPI,
  settingsAPI,
  studentAttendanceAPI,
  reportAPI,
  eventAPI,
  studentAPI,
  sportAPI,
} from "@/services/api";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import {
  Download,
  Printer,
  ChevronDown,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Search,
  FileText,
  BarChart2,
  Users,
  Calendar,
  IndianRupee,
  Clock,
  TrendingUp,
  Shield,
  CreditCard,
  BookOpen,
  Building2,
  X,
} from "lucide-react";

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
const YEARS = Array.from(
  { length: 5 },
  (_, i) => new Date().getFullYear() - 2 + i,
);

type Category = "payroll" | "attendance" | "employee" | "student";

interface ReportDef {
  id: string;
  name: string;
  desc: string;
  category: Category;
  icon: typeof FileText;
  available: boolean;
}

const REPORTS: ReportDef[] = [
  {
    id: "pay-report",
    name: "Pay Report",
    desc: "Employee datewise present, absent and half day status with attendance summary and payment details.",
    category: "payroll",
    icon: IndianRupee,
    available: true,
  },
  {
    id: "salary-register",
    name: "Salary Register",
    desc: "Full salary register with all components — basic, HRA, allowances, deductions and net pay.",
    category: "payroll",
    icon: BookOpen,
    available: true,
  },
  {
    id: "net-salary",
    name: "Net Salary Report",
    desc: "Employee net salary report showing take-home pay after all deductions.",
    category: "payroll",
    icon: TrendingUp,
    available: true,
  },
  {
    id: "salary-slip",
    name: "Salary Slip",
    desc: "Individual salary slip showing earnings, deductions and net pay. Printable per employee.",
    category: "payroll",
    icon: FileText,
    available: true,
  },
  {
    id: "pf-register",
    name: "PF Register",
    desc: "Provident Fund register showing employee and employer PF contributions.",
    category: "payroll",
    icon: Shield,
    available: true,
  },
  {
    id: "esic-register",
    name: "ESIC Register Report",
    desc: "ESIC register showing employee-wise ESIC contributions.",
    category: "payroll",
    icon: Shield,
    available: true,
  },
  {
    id: "bank-upload",
    name: "Bank Upload Report",
    desc: "Bank transfer file for salary disbursement. Account numbers and net pay for bulk upload.",
    category: "payroll",
    icon: CreditCard,
    available: true,
  },
  {
    id: "absent-leave-summary",
    name: "Absent/Leave Summary Report",
    desc: "Total leave of employee — unpaid leave and paid leave summary.",
    category: "payroll",
    icon: Calendar,
    available: true,
  },
  {
    id: "late-coming-summary",
    name: "Late Coming Summary Report",
    desc: "Summary of late arrivals per employee for the selected period.",
    category: "payroll",
    icon: Clock,
    available: true,
  },
  {
    id: "designation-summary",
    name: "Designation Summary Report",
    desc: "Monthly summary of employee counts and payroll grouped by designation.",
    category: "payroll",
    icon: Building2,
    available: true,
  },
  {
    id: "tally-export",
    name: "Tally Export",
    desc: "Export monthly payroll data as CSV for direct import into Tally ERP.",
    category: "payroll",
    icon: Download,
    available: true,
  },
  {
    id: "pt-register",
    name: "PT Register Report",
    desc: "Professional Tax register for all employees.",
    category: "payroll",
    icon: Shield,
    available: false,
  },
  {
    id: "lwf-register",
    name: "LWF Register Report",
    desc: "Labour Welfare Fund register showing employee LWF contributions.",
    category: "payroll",
    icon: Shield,
    available: false,
  },
  {
    id: "loan-report",
    name: "Loan Report",
    desc: "Loan details — Previous Loan Balance, New Loan Taken, Loan Cleared, Loan Balance.",
    category: "payroll",
    icon: BookOpen,
    available: false,
  },
  {
    id: "bonus-report",
    name: "Bonus Report",
    desc: "Yearly/Monthly bonus report calculated according to custom formula.",
    category: "payroll",
    icon: TrendingUp,
    available: false,
  },
  {
    id: "overtime-summary",
    name: "Overtime Summary Report",
    desc: "Summary of overtime hours and amounts for all employees in the period.",
    category: "payroll",
    icon: Clock,
    available: false,
  },
  {
    id: "compliance-report",
    name: "Compliance Report",
    desc: "Employee compliance summary — PF, ESI, PT, TDS compliance details.",
    category: "payroll",
    icon: Shield,
    available: false,
  },
  {
    id: "early-going-summary",
    name: "Early Going Summary Report",
    desc: "Summary of early departures per employee for the selected period.",
    category: "payroll",
    icon: Clock,
    available: false,
  },
  {
    id: "excess-break-summary",
    name: "Excess Break Summary Report",
    desc: "Summary of employees who exceeded allowed break time in the period.",
    category: "payroll",
    icon: Clock,
    available: false,
  },
  {
    id: "pf-challan",
    name: "PF Challan ECR Report",
    desc: "PF Electronic Challan cum Return (ECR) file for PF authority submission.",
    category: "payroll",
    icon: FileText,
    available: false,
  },
  {
    id: "esic-challan",
    name: "ESIC Challan Report",
    desc: "ESIC challan report for submission to ESIC authority.",
    category: "payroll",
    icon: FileText,
    available: false,
  },

  {
    id: "attendance-report",
    name: "Employee Attendance Report",
    desc: "Employee datewise present, absent and half day status with attendance summary.",
    category: "attendance",
    icon: BarChart2,
    available: true,
  },
  {
    id: "attendance-inout",
    name: "Attendance In/Out Report",
    desc: "Attendance in and out times for each employee for each date in the selected period.",
    category: "attendance",
    icon: Clock,
    available: true,
  },
  {
    id: "attendance-summary",
    name: "Attendance Summary",
    desc: "Attendance summary with datewise present, absent and half day status for all employees.",
    category: "attendance",
    icon: BarChart2,
    available: true,
  },
  {
    id: "leave-report",
    name: "Leave Report",
    desc: "Employee datewise leave report showing leave types and days for the period.",
    category: "attendance",
    icon: Calendar,
    available: true,
  },
  {
    id: "miss-punch",
    name: "Miss Punch Report",
    desc: "Employees with missing punch-in or punch-out entries for each date.",
    category: "attendance",
    icon: AlertCircle,
    available: true,
  },
  {
    id: "attendance-inout-vertical",
    name: "Attendance In Out Vertical Report",
    desc: "Vertical format attendance in/out — one date per row showing all employees.",
    category: "attendance",
    icon: BarChart2,
    available: false,
  },
  {
    id: "locationwise",
    name: "Locationwise Report",
    desc: "Attendance report grouped by location/branch showing all employees presence data.",
    category: "attendance",
    icon: Building2,
    available: false,
  },
  {
    id: "punch-log",
    name: "Punch Log Detail Report",
    desc: "Detail of each punch — all in/out punches from biometric device for the period.",
    category: "attendance",
    icon: FileText,
    available: false,
  },
  {
    id: "attendance-history",
    name: "Attendance History",
    desc: "History of all attendance changes. Shows original and modified attendance records.",
    category: "attendance",
    icon: BookOpen,
    available: false,
  },

  {
    id: "employee-directory",
    name: "Employee Directory",
    desc: "Full employee list with all details including contact, department, designation, salary.",
    category: "employee",
    icon: Users,
    available: true,
  },
  {
    id: "employee-report",
    name: "Employee Report",
    desc: "Select an employee and report type — attendance, salary slip, leave, or full profile.",
    category: "employee",
    icon: FileText,
    available: true,
  },

  {
    id: "student-attendance-report",
    name: "Student Attendance Report",
    desc: "Datewise present, absent and excused status for students, filterable by month, batch and sport.",
    category: "student",
    icon: BarChart2,
    available: true,
  },
  {
    id: "student-subscription-report",
    name: "Student Subscription Report",
    desc: "Subscription plan, billing cycle, renewal date and payment status for every enrolled student.",
    category: "student",
    icon: CreditCard,
    available: true,
  },
  {
    id: "tournament-report",
    name: "Tournament Results Report",
    desc: "Fixtures, scores and winners for a tournament — round by round results by team.",
    category: "student",
    icon: TrendingUp,
    available: true,
  },
  {
    id: "student-directory",
    name: "Student Directory",
    desc: "Full student list with contact, batch, sport and guardian details.",
    category: "student",
    icon: Users,
    available: true,
  },
  {
    id: "student-fee-report",
    name: "Student Fee Report",
    desc: "Fee charges, invoices and payment status for students.",
    category: "student",
    icon: IndianRupee,
    available: true,
  },
  {
    id: "student-outstanding-dues",
    name: "Outstanding Dues Report",
    desc: "List of students with outstanding payments and overdue amounts.",
    category: "student",
    icon: CreditCard,
    available: true,
  },
  {
    id: "student-performance",
    name: "Student Performance Report",
    desc: "Progress and assessment reports for students (coach/assessment inputs).",
    category: "student",
    icon: BookOpen,
    available: false,
  },
  {
    id: "student-enrollment",
    name: "Enrollment Report",
    desc: "New enrollments, cancellations and net joins for the selected period.",
    category: "student",
    icon: Calendar,
    available: true,
  },
  {
    id: "student-batch-summary",
    name: "Batch Summary Report",
    desc: "Batch-wise headcount and active/inactive summary.",
    category: "student",
    icon: Building2,
    available: true,
  },
  {
    id: "student-sport-summary",
    name: "Sport-wise Summary",
    desc: "Summary of students grouped by sport with counts and subscriptions.",
    category: "student",
    icon: BarChart2,
    available: true,
  },
  {
    id: "student-guardian-list",
    name: "Guardian Contact List",
    desc: "Guardian names and contact details for all students.",
    category: "student",
    icon: Users,
    available: true,
  },
  {
    id: "student-payment-history",
    name: "Student Payment History",
    desc: "Detailed payment ledger for each student (transactions and receipts).",
    category: "student",
    icon: FileText,
    available: true,
  },
];

function exportCSV(rows: string[][], filename: string) {
  const csv = rows
    .map((r) =>
      r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportXLSX(rows: string[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, filename.replace(".csv", ".xlsx"));
}

function printReport(
  title: string,
  period: string,
  headers: string[],
  rows: string[][],
  opts: {
    company?: ReportCompany;
    reportCategory?: string;
    generatedFor?: string;
  } = {},
) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(buildReportHTML(title, period, headers, rows, opts));
  win.document.close();
}

function NbSelect({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none border-2 border-black px-3 py-2 pr-8 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
    </div>
  );
}

function CategoryTag({ cat }: { cat: Category }) {
  const styles: Record<Category, string> = {
    payroll: "bg-[#024BAB] text-white",
    attendance: "bg-[#00C48C] text-white",
    employee: "bg-[#FA731C] text-white",
    student: "bg-[#A855F7] text-white",
  };
  const labels: Record<Category, string> = {
    payroll: "PayRoll",
    attendance: "Attendance",
    employee: "Employee",
    student: "Student",
  };
  return (
    <span
      className={cn(
        "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-black",
        styles[cat],
      )}
    >
      {labels[cat]}
    </span>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="border-2 bg-white p-12 flex flex-col items-center gap-3">
      <AlertCircle className="w-10 h-10 text-black/20" />
      <p className="font-bold text-black">{msg}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex justify-center py-16">
      <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  present: "bg-green-100 text-green-700 border border-green-300",
  late: "bg-orange-100 text-orange-700 border border-orange-300",
  absent: "bg-red-100 text-red-700 border border-red-300",
  half_day: "bg-yellow-100 text-yellow-700 border border-yellow-300",
  "half day": "bg-yellow-100 text-yellow-700 border border-yellow-300",
  on_leave: "bg-blue-100 text-blue-700 border border-blue-300",
  "on leave": "bg-blue-100 text-blue-700 border border-blue-300",
  leave: "bg-blue-100 text-blue-700 border border-blue-300",
  holiday: "bg-purple-100 text-purple-700 border border-purple-300",
  weekend: "bg-gray-100 text-gray-500 border border-gray-200",
  paid: "bg-green-100 text-green-700 border border-green-300",
  pending: "bg-orange-100 text-orange-700 border border-orange-300",
  approved: "bg-green-100 text-green-700 border border-green-300",
  rejected: "bg-red-100 text-red-700 border border-red-300",
  cancelled: "bg-gray-100 text-gray-500 border border-gray-200",
  active: "bg-green-100 text-green-700 border border-green-300",
  inactive: "bg-red-100 text-red-700 border border-red-300",
  terminated: "bg-red-100 text-red-700 border border-red-300",
  missing: "bg-red-100 text-red-700 border border-red-300",
  neft: "bg-blue-100 text-blue-700 border border-blue-300",
};

const AVATAR_PALETTE = [
  "#024BAB",
  "#00C48C",
  "#FA731C",
  "#7C3AED",
  "#0891B2",
  "#DC2626",
];
function getAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++)
    h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function StatusCell({ val }: { val: string }) {
  const key = val.toLowerCase().trim();
  const cls = STATUS_BADGE[key];
  if (cls)
    return (
      <span
        className={cn(
          "px-2 py-0.5 text-[10px] font-bold uppercase rounded",
          cls,
        )}
      >
        {val}
      </span>
    );
  return <span>{val}</span>;
}

function NameCell({ name }: { name: string }) {
  if (!name || name === "—") return <span>{name}</span>;
  const color = getAvatarColor(name);
  const initials = getInitials(name);
  return (
    <span className="flex items-center gap-2">
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {initials}
      </span>
      <span>{name}</span>
    </span>
  );
}

function ReportTable({
  id,
  headers,
  rows,
}: {
  id: string;
  headers: string[];
  rows: string[][];
}) {
  const nameColIdx = headers.findIndex((h) =>
    ["employee", "name", "employee name", "student", "team a"].includes(
      h.toLowerCase(),
    ),
  );
  const statusColIdx = headers.findIndex((h) =>
    ["status", "payment status"].includes(h.toLowerCase()),
  );

  return (
    <div className="border-2 bg-white overflow-hidden">
      <div id={id} className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-black bg-[#024BAB]/5">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  "border-b border-black/10",
                  i % 2 !== 0 && "bg-[#F8FAFF]",
                )}
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-4 py-2.5 text-sm text-black whitespace-nowrap"
                  >
                    {j === nameColIdx ? (
                      <NameCell name={cell} />
                    ) : j === statusColIdx ? (
                      <StatusCell val={cell} />
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayReportGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Employee",
    "Emp ID",
    "Department",
    "Basic",
    "HRA",
    "DA",
    "TA",
    "Medical",
    "Gross",
    "PF",
    "ESI",
    "TDS",
    "Net Pay",
    "Status",
  ];
  const rows = data.map((p) => [
    p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "—",
    p.employee?.employeeId || "—",
    p.employee?.department?.name || "—",
    formatCurrency(p.basicSalary || 0),
    formatCurrency(p.hra || 0),
    formatCurrency(p.da || 0),
    formatCurrency(p.ta || 0),
    formatCurrency(p.medicalAllowance || 0),
    formatCurrency(p.grossSalary || 0),
    formatCurrency(p.pf || 0),
    formatCurrency(p.esi || 0),
    formatCurrency(p.tds || 0),
    formatCurrency(p.netSalary || 0),
    p.status?.toUpperCase() || "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Pay Report",
                `${MONTHS[+month - 1]} ${year}`,
                headers,
                rows,
                { company, reportCategory: "Payroll" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `pay_report_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={() =>
              exportXLSX(
                [headers, ...rows],
                `pay_report_${MONTHS[+month - 1]}_${year}.xlsx`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#00C48C] text-white"
          >
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No payroll records for this period" />
      ) : (
        <ReportTable id="pay-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function SalaryRegisterGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Emp ID",
    "Name",
    "Dept",
    "Basic",
    "HRA",
    "DA",
    "TA",
    "Medical",
    "Other Allow.",
    "Gross",
    "PF Emp.",
    "ESI Emp.",
    "TDS",
    "Prof Tax",
    "Total Ded.",
    "Net Pay",
  ];
  const rows = data.map((p) => [
    p.employee?.employeeId || "—",
    p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "—",
    p.employee?.department?.name || "—",
    formatCurrency(p.basicSalary || 0),
    formatCurrency(p.hra || 0),
    formatCurrency(p.da || 0),
    formatCurrency(p.ta || 0),
    formatCurrency(p.medicalAllowance || 0),
    formatCurrency(0),
    formatCurrency(p.grossSalary || 0),
    formatCurrency(p.pf || 0),
    formatCurrency(p.esi || 0),
    formatCurrency(p.tds || 0),
    formatCurrency(0),
    formatCurrency(p.totalDeductions || 0),
    formatCurrency(p.netSalary || 0),
  ]);

  const totalGross = data.reduce((s, p) => s + (p.grossSalary || 0), 0);
  const totalNet = data.reduce((s, p) => s + (p.netSalary || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Salary Register",
                `${MONTHS[+month - 1]} ${year}`,
                headers,
                rows,
                { company, reportCategory: "Payroll" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `salary_register_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {data.length > 0 && (
        <div className="flex gap-4">
          <div className="border-2 bg-[#024BAB] text-white p-4 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">
              Total Gross
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(totalGross)}
            </p>
          </div>
          <div className="border-2 bg-[#00C48C] text-white p-4 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">
              Total Net Pay
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(totalNet)}
            </p>
          </div>
          <div className="border-2 bg-[#EF4444] text-white p-4 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">
              Total Deductions
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(totalGross - totalNet)}
            </p>
          </div>
        </div>
      )}
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No payroll records for this period" />
      ) : (
        <ReportTable id="sal-reg-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function NetSalaryGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Emp ID",
    "Employee Name",
    "Department",
    "Designation",
    "Gross Salary",
    "Total Deductions",
    "Net Pay",
    "Payment Status",
  ];
  const rows = data.map((p) => [
    p.employee?.employeeId || "—",
    p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "—",
    p.employee?.department?.name || "—",
    p.employee?.designation || "—",
    formatCurrency(p.grossSalary || 0),
    formatCurrency(p.totalDeductions || 0),
    formatCurrency(p.netSalary || 0),
    p.status?.toUpperCase() || "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `net_salary_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No payroll records for this period" />
      ) : (
        <ReportTable id="net-sal-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function SalarySlipGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    load();
    setSelected(null);
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  function printSlip() {
    if (!selected) return;
    const p = selected;
    const emp = p.employee || {};
    const win = window.open("", "_blank");
    if (!win) return;
    const companyName = company?.name || "NestSports";
    const companyLogo = company?.logo || "";
    const empName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
    const now = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    win.document.write(`<!DOCTYPE html>
<html><head><title>Salary Slip</title><style>
  @page { size: A4; margin: 15mm 15mm 22mm; @bottom-right { content: "Page " counter(page); font-size: 9px; color: #6B7280; } }
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "DM Sans", Arial, sans-serif; font-size: 12px; color: #111; max-width: 700px; margin: auto; }
  .report-header { display: flex; align-items: stretch; justify-content: space-between; gap: 16px; border-bottom: 3px solid #024BAB; padding-bottom: 12px; margin-bottom: 18px; }
  .header-company { display: flex; align-items: center; gap: 10px; }
  .header-company img { height: 44px; width: auto; object-fit: contain; }
  .company-name { font-size: 17px; font-weight: 700; color: #024BAB; }
  .company-sub { font-size: 9px; color: #9CA3AF; margin-top: 2px; }
  .header-center { flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .report-badge { display: inline-block; background: #EFF6FF; color: #024BAB; border: 1px solid #BFDBFE; border-radius: 3px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 7px; margin-bottom: 4px; }
  .report-title { font-size: 15px; font-weight: 700; color: #111; }
  .report-period { font-size: 11px; color: #6B7280; margin-top: 3px; }
  .header-right { text-align: right; display: flex; flex-direction: column; justify-content: center; min-width: 160px; }
  .gen-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #9CA3AF; margin-bottom: 2px; }
  .gen-date { font-size: 11px; font-weight: 700; color: #111; }
  .gen-for { font-size: 10px; color: #6B7280; margin-top: 3px; }
  .emp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #F8FAFF; border: 1px solid #E5E7EB; padding: 10px 12px; margin-bottom: 16px; font-size: 12px; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #F3F4F6; }
  .row:last-child { border-bottom: none; }
  .lbl { color: #6B7280; }
  .amt { font-weight: 700; }
  .section { margin-top: 14px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #024BAB; border-bottom: 2px solid #024BAB; padding-bottom: 4px; margin-bottom: 6px; }
  .total { font-weight: 700; font-size: 13px; background: #EFF6FF; padding: 7px 0; }
  .net { font-weight: 700; font-size: 14px; background: #DCFCE7; color: #15803D; padding: 8px 0; }
  .footer-bar { margin-top: 20px; border-top: 1px solid #E5E7EB; padding-top: 6px; display: flex; justify-content: space-between; font-size: 9px; color: #9CA3AF; }
</style></head><body>
  <div class="report-header">
    <div class="header-company">
      ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" />` : ""}
      <div>
        <div class="company-name">${companyName}</div>
        <div class="company-sub">Human Resource Management System</div>
      </div>
    </div>
    <div class="header-center">
      <span class="report-badge">Payroll</span>
      <div class="report-title">Salary Slip</div>
      <div class="report-period">${MONTHS[+month - 1]} ${year}</div>
    </div>
    <div class="header-right">
      <div class="gen-label">Report Generated</div>
      <div class="gen-date">${now}</div>
      <div class="gen-for">For: <b>${empName}</b></div>
    </div>
  </div>

  <div class="emp-grid">
    <div><span style="color:#6B7280;">Employee: </span><b>${empName}</b></div>
    <div><span style="color:#6B7280;">Emp ID: </span><b>${emp.employeeId || "—"}</b></div>
    <div><span style="color:#6B7280;">Department: </span><b>${emp.department?.name || "—"}</b></div>
    <div><span style="color:#6B7280;">Designation: </span><b>${emp.designation || "—"}</b></div>
  </div>

  <div class="section">Earnings</div>
  <div class="row"><span class="lbl">Basic Salary</span><span class="amt">₹${(p.basicSalary || 0).toLocaleString("en-IN")}</span></div>
  <div class="row"><span class="lbl">HRA</span><span class="amt">₹${(p.hra || 0).toLocaleString("en-IN")}</span></div>
  <div class="row"><span class="lbl">DA</span><span class="amt">₹${(p.da || 0).toLocaleString("en-IN")}</span></div>
  <div class="row"><span class="lbl">TA</span><span class="amt">₹${(p.ta || 0).toLocaleString("en-IN")}</span></div>
  <div class="row"><span class="lbl">Medical Allowance</span><span class="amt">₹${(p.medicalAllowance || 0).toLocaleString("en-IN")}</span></div>
  ${(p.allowances || []).map((a: any) => `<div class="row"><span class="lbl">${a.label}</span><span class="amt">₹${Number(a.amount || 0).toLocaleString("en-IN")}</span></div>`).join("")}
  <div class="row total"><span>Gross Salary</span><span>₹${(p.grossSalary || 0).toLocaleString("en-IN")}</span></div>

  <div class="section">Deductions</div>
  <div class="row"><span class="lbl">Provident Fund (PF)</span><span class="amt">₹${(p.pf || 0).toLocaleString("en-IN")}</span></div>
  <div class="row"><span class="lbl">ESI</span><span class="amt">₹${(p.esi || 0).toLocaleString("en-IN")}</span></div>
  <div class="row"><span class="lbl">TDS</span><span class="amt">₹${(p.tds || 0).toLocaleString("en-IN")}</span></div>
  ${(p.deductions || []).map((d: any) => `<div class="row"><span class="lbl">${d.label}</span><span class="amt">₹${Number(d.amount || 0).toLocaleString("en-IN")}</span></div>`).join("")}
  <div class="row total"><span>Total Deductions</span><span>₹${(p.totalDeductions || 0).toLocaleString("en-IN")}</span></div>

  <div class="row net"><span>NET PAY</span><span>₹${(p.netSalary || 0).toLocaleString("en-IN")}</span></div>

  <div class="footer-bar">
    <span>${companyName} — Confidential</span>
    <span>Salary Slip · ${MONTHS[+month - 1]} ${year}</span>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body></html>`);
    win.document.close();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        {selected && (
          <button
            onClick={printSlip}
            className="ml-auto flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print Slip
          </button>
        )}
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No payroll records for this period" />
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Select an employee to view salary slip
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.map((p) => (
              <button
                key={p._id}
                onClick={() => setSelected(selected?._id === p._id ? null : p)}
                className={cn(
                  "border-2 p-4 text-left transition-all hover:-translate-y-0.5",
                  selected?._id === p._id
                    ? "bg-[#024BAB] text-white"
                    : "bg-white",
                )}
              >
                <p
                  className={cn(
                    "font-bold text-sm",
                    selected?._id === p._id ? "text-white" : "text-black",
                  )}
                >
                  {p.employee
                    ? `${p.employee.firstName} ${p.employee.lastName}`
                    : "—"}
                </p>
                <p
                  className={cn(
                    "text-xs mt-0.5",
                    selected?._id === p._id
                      ? "text-white/70"
                      : "text-muted-foreground",
                  )}
                >
                  {p.employee?.department?.name} · {p.employee?.designation}
                </p>
                <p
                  className={cn(
                    "text-sm font-bold mt-2",
                    selected?._id === p._id ? "text-white" : "text-[#00C48C]",
                  )}
                >
                  Net: {formatCurrency(p.netSalary || 0)}
                </p>
              </button>
            ))}
          </div>
          {selected && (
            <div className="border-2 bg-white p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-black">
                    {selected.employee?.firstName} {selected.employee?.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selected.employee?.employeeId} ·{" "}
                    {selected.employee?.department?.name} ·{" "}
                    {selected.employee?.designation}
                  </p>
                </div>
                <span className="px-3 py-1 border-2 border-black bg-[#024BAB] text-white text-xs font-bold">
                  {MONTHS[+month - 1]} {year}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Earnings
                  </p>
                  {[
                    ["Basic Salary", selected.basicSalary],
                    ["HRA", selected.hra],
                    ["DA", selected.da],
                    ["TA", selected.ta],
                    ["Medical Allow.", selected.medicalAllowance],
                  ].map(([l, v]) => (
                    <div
                      key={String(l)}
                      className="flex justify-between py-1.5 border-b border-black/10 text-sm"
                    >
                      <span className="text-muted-foreground">{l}</span>
                      <span className="font-bold text-black">
                        {formatCurrency(Number(v) || 0)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 mt-1 bg-[#024BAB]/5 px-2 text-sm font-bold">
                    <span>Gross Salary</span>
                    <span>{formatCurrency(selected.grossSalary || 0)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Deductions
                  </p>
                  {[
                    ["Provident Fund", selected.pf],
                    ["ESI", selected.esi],
                    ["TDS", selected.tds],
                  ].map(([l, v]) => (
                    <div
                      key={String(l)}
                      className="flex justify-between py-1.5 border-b border-black/10 text-sm"
                    >
                      <span className="text-muted-foreground">{l}</span>
                      <span className="font-bold text-[#EF4444]">
                        -{formatCurrency(Number(v) || 0)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 mt-1 bg-red-50 px-2 text-sm font-bold">
                    <span>Total Deductions</span>
                    <span className="text-[#EF4444]">
                      -{formatCurrency(selected.totalDeductions || 0)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="border-2 border-black bg-[#00C48C] p-4 flex justify-between items-center">
                <span className="text-white font-bold text-lg uppercase tracking-wide">
                  Net Pay
                </span>
                <span className="text-white font-bold text-2xl">
                  {formatCurrency(selected.netSalary || 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PFRegisterGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data.filter((p: any) => (p.pf || 0) > 0));
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Emp ID",
    "Employee Name",
    "Department",
    "UAN / PF No.",
    "Basic Salary",
    "PF (Employee 12%)",
    "PF (Employer 12%)",
    "Total PF",
  ];
  const rows = data.map((p) => [
    p.employee?.employeeId || "—",
    p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "—",
    p.employee?.department?.name || "—",
    p.employee?.pfNumber || "—",
    formatCurrency(p.basicSalary || 0),
    formatCurrency(p.pf || 0),
    formatCurrency(p.pf || 0),
    formatCurrency((p.pf || 0) * 2),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `pf_register_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No PF records for this period" />
      ) : (
        <ReportTable id="pf-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function ESICRegisterGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data.filter((p: any) => (p.esi || 0) > 0));
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Emp ID",
    "Employee Name",
    "Department",
    "ESIC No.",
    "Gross Salary",
    "ESI (Employee 0.75%)",
    "ESI (Employer 3.25%)",
    "Total ESI",
  ];
  const rows = data.map((p) => [
    p.employee?.employeeId || "—",
    p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "—",
    p.employee?.department?.name || "—",
    p.employee?.esicNumber || "—",
    formatCurrency(p.grossSalary || 0),
    formatCurrency(p.esi || 0),
    formatCurrency(Math.round((p.esi || 0) * (3.25 / 0.75))),
    formatCurrency(p.esi || 0 + Math.round((p.esi || 0) * (3.25 / 0.75))),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `esic_register_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No ESIC records for this period" />
      ) : (
        <ReportTable id="esic-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function BankUploadGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Emp ID",
    "Employee Name",
    "Bank Name",
    "Account Number",
    "IFSC Code",
    "Net Pay",
    "Payment Mode",
  ];
  const rows = data.map((p) => [
    p.employee?.employeeId || "—",
    p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "—",
    p.employee?.bankName || "—",
    p.employee?.bankAccount || "—",
    p.employee?.ifsc || "—",
    formatCurrency(p.netSalary || 0),
    "NEFT",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `bank_upload_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No payroll records for this period" />
      ) : (
        <ReportTable id="bank-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function AbsentLeaveSummaryGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState("all");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year, dept]);
  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { month, year, limit: "500" };
      if (dept !== "all") params.department = dept;
      const r = await attendanceAPI.getAll(params);
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const empMap = new Map<string, any>();
  data.forEach((rec) => {
    if (!rec.employee) return;
    const id = rec.employee._id;
    if (!empMap.has(id))
      empMap.set(id, {
        emp: rec.employee,
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
        halfDay: 0,
        total: 0,
      });
    const e = empMap.get(id);
    e.total++;
    if (rec.status === "present") e.present++;
    else if (rec.status === "late") e.late++;
    else if (rec.status === "absent") e.absent++;
    else if (rec.status === "on_leave") e.leave++;
    else if (rec.status === "half_day") e.halfDay++;
  });

  const summaryRows = Array.from(empMap.values());
  const headers = [
    "Emp ID",
    "Employee Name",
    "Department",
    "Total Days",
    "Present",
    "Late",
    "Absent",
    "On Leave",
    "Half Day",
    "Attendance %",
  ];
  const rows = summaryRows.map(
    ({ emp, present, late, absent, leave, halfDay, total }) => [
      emp.employeeId || "—",
      `${emp.firstName} ${emp.lastName}`,
      emp.department?.name || "—",
      String(total),
      String(present),
      String(late),
      String(absent),
      String(leave),
      String(halfDay),
      total > 0 ? `${(((present + late) / total) * 100).toFixed(1)}%` : "0%",
    ],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `absent_leave_summary_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No attendance records for this period" />
      ) : (
        <ReportTable id="al-summary-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function LateComingGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState("all");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year, dept]);
  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { month, year, limit: "500" };
      if (dept !== "all") params.department = dept;
      const r = await attendanceAPI.getAll(params);
      if (r.success)
        setData(r.data.filter((rec: any) => rec.status === "late"));
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Date",
    "Emp ID",
    "Employee Name",
    "Department",
    "Check In Time",
    "Expected Time",
    "Late By",
  ];
  const rows = data.map((rec) => {
    const checkIn = rec.checkIn ? new Date(rec.checkIn) : null;
    const expectedHr = 9;
    const lateMinutes = checkIn
      ? Math.max(
          0,
          (checkIn.getHours() - expectedHr) * 60 + checkIn.getMinutes(),
        )
      : 0;
    return [
      formatDate(rec.date),
      rec.employee?.employeeId || "—",
      rec.employee ? `${rec.employee.firstName} ${rec.employee.lastName}` : "—",
      rec.employee?.department?.name || "—",
      checkIn
        ? checkIn.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      "09:00 AM",
      lateMinutes > 0 ? `${lateMinutes} min` : "—",
    ];
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `late_coming_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No late arrivals for this period" />
      ) : (
        <ReportTable id="late-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function DesignationSummaryGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);
  async function load() {
    setLoading(true);
    try {
      const r = await employeeAPI.getAll({ limit: "500", status: "active" });
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const desigMap = new Map<
    string,
    { count: number; totalSalary: number; dept: string }
  >();
  data.forEach((emp) => {
    const key = emp.designation || "Unknown";
    if (!desigMap.has(key))
      desigMap.set(key, {
        count: 0,
        totalSalary: 0,
        dept: emp.department?.name || "—",
      });
    const e = desigMap.get(key)!;
    e.count++;
    e.totalSalary += emp.salary || 0;
  });

  const headers = [
    "Designation",
    "Department",
    "Employee Count",
    "Total Payroll (p.a.)",
    "Avg. Salary (p.a.)",
  ];
  const rows = Array.from(desigMap.entries()).map(
    ([desig, { count, totalSalary, dept }]) => [
      desig,
      dept,
      String(count),
      formatCurrency(totalSalary),
      formatCurrency(count > 0 ? totalSalary / count : 0),
    ],
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() =>
            exportCSV([headers, ...rows], `designation_summary.csv`)
          }
          className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No active employees found" />
      ) : (
        <ReportTable id="desig-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function AttendanceReportGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState("all");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year, dept]);
  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { month, year, limit: "500" };
      if (dept !== "all") params.department = dept;
      const r = await attendanceAPI.getAll(params);
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Date",
    "Employee",
    "Emp ID",
    "Department",
    "Status",
    "Check In",
    "Check Out",
    "Work Hours",
  ];
  const rows = data.map((rec) => [
    formatDate(rec.date),
    rec.employee ? `${rec.employee.firstName} ${rec.employee.lastName}` : "—",
    rec.employee?.employeeId || "—",
    rec.employee?.department?.name || "—",
    rec.status?.toUpperCase().replace("_", " ") || "—",
    rec.checkIn
      ? new Date(rec.checkIn).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    rec.checkOut
      ? new Date(rec.checkOut).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    rec.workHours ? `${rec.workHours}h` : "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Employee Attendance Report",
                `${MONTHS[+month - 1]} ${year}`,
                headers,
                rows,
                { company, reportCategory: "Attendance" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `attendance_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No attendance records for this period" />
      ) : (
        <ReportTable id="att-rpt-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function AttendanceInOutGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState("all");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year, dept]);
  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { month, year, limit: "500" };
      if (dept !== "all") params.department = dept;
      const r = await attendanceAPI.getAll(params);
      if (r.success) setData(r.data.filter((rec: any) => rec.checkIn));
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Date",
    "Employee",
    "Emp ID",
    "Department",
    "In Time",
    "Out Time",
    "Total Hours",
    "Status",
  ];
  const rows = data.map((rec) => [
    formatDate(rec.date),
    rec.employee ? `${rec.employee.firstName} ${rec.employee.lastName}` : "—",
    rec.employee?.employeeId || "—",
    rec.employee?.department?.name || "—",
    rec.checkIn
      ? new Date(rec.checkIn).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    rec.checkOut
      ? new Date(rec.checkOut).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Missing",
    rec.workHours ? `${rec.workHours}h` : "—",
    rec.status?.toUpperCase().replace("_", " ") || "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `attendance_inout_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No punch records for this period" />
      ) : (
        <ReportTable id="inout-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function AttendanceSummaryGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState("all");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year, dept]);
  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { month, year, limit: "500" };
      if (dept !== "all") params.department = dept;
      const r = await attendanceAPI.getAll(params);
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const empMap = new Map<string, any>();
  data.forEach((rec) => {
    if (!rec.employee) return;
    const id = rec.employee._id;
    if (!empMap.has(id))
      empMap.set(id, {
        emp: rec.employee,
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
        halfDay: 0,
        total: 0,
      });
    const e = empMap.get(id);
    e.total++;
    if (rec.status === "present") e.present++;
    else if (rec.status === "late") e.late++;
    else if (rec.status === "absent") e.absent++;
    else if (rec.status === "on_leave") e.leave++;
    else if (rec.status === "half_day") e.halfDay++;
  });

  const headers = [
    "Emp ID",
    "Employee",
    "Department",
    "Present",
    "Late",
    "Absent",
    "On Leave",
    "Half Day",
    "Total",
    "Attendance %",
  ];
  const rows = Array.from(empMap.values()).map(
    ({ emp, present, late, absent, leave, halfDay, total }) => [
      emp.employeeId || "—",
      `${emp.firstName} ${emp.lastName}`,
      emp.department?.name || "—",
      String(present),
      String(late),
      String(absent),
      String(leave),
      String(halfDay),
      String(total),
      total > 0 ? `${(((present + late) / total) * 100).toFixed(1)}%` : "0%",
    ],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `attendance_summary_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No attendance records for this period" />
      ) : (
        <ReportTable id="att-sum-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function LeaveReportGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [leaveType, setLeaveType] = useState("all");
  const [status, setStatus] = useState("all");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [year, leaveType, status]);
  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "500", year };
      if (leaveType !== "all") params.leaveType = leaveType;
      if (status !== "all") params.status = status;
      const r = await leaveAPI.getAll(params);
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Emp ID",
    "Employee",
    "Department",
    "Leave Type",
    "From",
    "To",
    "Days",
    "Reason",
    "Status",
  ];
  const rows = data.map((l) => [
    l.employee?.employeeId || "—",
    l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : "—",
    l.employee?.department?.name || "—",
    l.leaveType?.charAt(0).toUpperCase() + l.leaveType?.slice(1) || "—",
    formatDate(l.startDate),
    formatDate(l.endDate),
    String(l.days || 0),
    l.reason || "—",
    l.status?.toUpperCase() || "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={leaveType} onChange={setLeaveType} className="w-40">
          <option value="all">All Types</option>
          {[
            "casual",
            "sick",
            "earned",
            "maternity",
            "paternity",
            "unpaid",
            "compensatory",
          ].map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={status} onChange={setStatus} className="w-36">
          <option value="all">All Statuses</option>
          {["pending", "approved", "rejected", "cancelled"].map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV([headers, ...rows], `leave_report_${year}.csv`)
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No leave records for this period" />
      ) : (
        <ReportTable id="leave-rpt-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function MissPunchGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState("all");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year, dept]);
  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { month, year, limit: "500" };
      if (dept !== "all") params.department = dept;
      const r = await attendanceAPI.getAll(params);
      if (r.success)
        setData(r.data.filter((rec: any) => rec.checkIn && !rec.checkOut));
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Date",
    "Emp ID",
    "Employee",
    "Department",
    "Check In",
    "Check Out",
    "Remark",
  ];
  const rows = data.map((rec) => [
    formatDate(rec.date),
    rec.employee?.employeeId || "—",
    rec.employee ? `${rec.employee.firstName} ${rec.employee.lastName}` : "—",
    rec.employee?.department?.name || "—",
    rec.checkIn
      ? new Date(rec.checkIn).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    "MISSING",
    "Punch-out not recorded",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `miss_punch_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No missing punch records for this period" />
      ) : (
        <ReportTable id="miss-punch-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function EmployeeDirectoryGen({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [dept, status]);
  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "500" };
      if (dept !== "all") params.department = dept;
      if (status !== "all") params.status = status;
      const r = await employeeAPI.getAll(params);
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Emp ID",
    "Name",
    "Email",
    "Phone",
    "Department",
    "Designation",
    "Type",
    "Join Date",
    "Salary (p.a.)",
    "Status",
  ];
  const rows = data.map((e) => [
    e.employeeId || "—",
    `${e.firstName} ${e.lastName}`,
    e.email || "—",
    e.phone || "—",
    e.department?.name || "—",
    e.designation || "—",
    e.employmentType?.replace(/_/g, " ") || "—",
    formatDate(e.joinDate),
    formatCurrency(e.salary || 0),
    e.status?.toUpperCase() || "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={dept} onChange={setDept} className="w-48">
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={status} onChange={setStatus} className="w-36">
          <option value="all">All Statuses</option>
          {["active", "inactive", "on_leave", "terminated"].map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ").charAt(0).toUpperCase() +
                s.replace("_", " ").slice(1)}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Employee Directory",
                new Date().toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                }),
                headers,
                rows,
                { company, reportCategory: "Employee" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV([headers, ...rows], `employee_directory.csv`)
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No employees match the filters" />
      ) : (
        <ReportTable id="emp-dir-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

const EMP_REPORT_TYPES = [
  {
    id: "attendance",
    label: "Attendance Report",
    desc: "Monthly attendance — daily status, check-in/out times",
  },
  {
    id: "salary-slip",
    label: "Salary Slip",
    desc: "Monthly salary slip with earnings, deductions, net pay",
  },
  {
    id: "leave",
    label: "Leave Report",
    desc: "Yearly leave history — types, dates, approval status",
  },
  {
    id: "profile",
    label: "Employee Profile",
    desc: "Full profile — personal, employment, bank details",
  },
];

function EmployeeReportGen({
  departments: _departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [reportType, setReportType] = useState<string | null>(null);
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [empLoading, setEmpLoading] = useState(true);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    employeeAPI
      .getAll({ limit: "500", status: "active" })
      .then((r) => {
        if (r.success) setEmployees(r.data);
        setEmpLoading(false);
      })
      .catch(() => setEmpLoading(false));
  }, []);

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return (
      !q ||
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      (e.employeeId || "").toLowerCase().includes(q) ||
      (e.department?.name || "").toLowerCase().includes(q)
    );
  });

  async function generate() {
    if (!selectedEmp || !reportType) return;
    setLoading(true);
    setGenerated(false);
    try {
      if (reportType === "attendance") {
        const r = await attendanceAPI.getAll({
          employeeId: selectedEmp._id,
          month,
          year,
          limit: "60",
        });
        setData(r.data || []);
      } else if (reportType === "salary-slip") {
        const r = await payrollAPI.getAll({
          employeeId: selectedEmp._id,
          month,
          year,
        });
        setData(r.data || []);
      } else if (reportType === "leave") {
        const r = await leaveAPI.getAll({
          employeeId: selectedEmp._id,
          year,
          limit: "200",
        });
        setData(r.data || []);
      } else if (reportType === "profile") {
        setData([selectedEmp]);
      }
    } catch {}
    setLoading(false);
    setGenerated(true);
  }

  function getHeaders() {
    if (reportType === "attendance")
      return ["Date", "Status", "Check In", "Check Out", "Work Hours"];
    if (reportType === "salary-slip") return ["Component", "Amount"];
    if (reportType === "leave")
      return ["From", "To", "Days", "Type", "Reason", "Status"];
    if (reportType === "profile") return ["Field", "Value"];
    return [];
  }

  function getRows(): string[][] {
    if (reportType === "attendance") {
      return data.map((r) => [
        new Date(r.date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          weekday: "short",
        }),
        (r.status || "").toUpperCase().replace("_", " "),
        r.checkIn
          ? new Date(r.checkIn).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
        r.checkOut
          ? new Date(r.checkOut).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
        r.workHours ? `${r.workHours}h` : "—",
      ]);
    }
    if (reportType === "salary-slip" && data[0]) {
      const p = data[0];
      return [
        ["Basic Salary", formatCurrency(p.basicSalary || 0)],
        ["HRA", formatCurrency(p.hra || 0)],
        ["DA", formatCurrency(p.da || 0)],
        ["TA", formatCurrency(p.ta || 0)],
        ["Medical Allowance", formatCurrency(p.medicalAllowance || 0)],
        ["Gross Salary", formatCurrency(p.grossSalary || 0)],
        ["PF (Deduction)", `- ${formatCurrency(p.pf || 0)}`],
        ["ESI (Deduction)", `- ${formatCurrency(p.esi || 0)}`],
        ["TDS (Deduction)", `- ${formatCurrency(p.tds || 0)}`],
        ["Total Deductions", `- ${formatCurrency(p.totalDeductions || 0)}`],
        ["NET PAY", formatCurrency(p.netSalary || 0)],
      ];
    }
    if (reportType === "leave") {
      return data.map((l) => [
        formatDate(l.startDate),
        formatDate(l.endDate),
        String(l.days || 0),
        (l.leaveType || "").charAt(0).toUpperCase() +
          (l.leaveType || "").slice(1),
        l.reason || "—",
        (l.status || "").toUpperCase(),
      ]);
    }
    if (reportType === "profile" && data[0]) {
      const e = data[0];
      return [
        ["Employee ID", e.employeeId || "—"],
        ["Full Name", `${e.firstName} ${e.lastName}`],
        ["Email", e.email || "—"],
        ["Phone", e.phone || "—"],
        ["Department", e.department?.name || "—"],
        ["Designation", e.designation || "—"],
        ["Employment Type", (e.employmentType || "").replace("_", " ")],
        ["Join Date", formatDate(e.joinDate)],
        ["Salary (p.a.)", formatCurrency(e.salary || 0)],
        ["Status", (e.status || "").toUpperCase()],
        ["Bank Name", e.bankName || "—"],
        ["Account No.", e.bankAccount || "—"],
        ["IFSC", e.ifsc || "—"],
        ["PF Number", e.pfNumber || "—"],
        ["ESIC Number", e.esicNumber || "—"],
      ];
    }
    return [];
  }

  const headers = getHeaders();
  const rows = getRows();
  const period =
    reportType === "leave" ? `Year ${year}` : `${MONTHS[+month - 1]} ${year}`;
  const empName = selectedEmp
    ? `${selectedEmp.firstName} ${selectedEmp.lastName}`
    : "";
  const color = selectedEmp ? getAvatarColor(empName) : "#024BAB";
  const initials = selectedEmp ? getInitials(empName) : "";

  return (
    <div className="space-y-5">
      {/* Step 1: Select Employee */}
      <div className="border-2 border-black bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB] mb-3">
          Step 1 — Select Employee
        </p>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID or department..."
            className="w-full border-2 border-black pl-9 pr-4 py-2 text-sm font-medium bg-white focus:outline-none"
          />
        </div>
        {empLoading ? (
          <LoadingState />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {filtered.map((emp) => {
              const name = `${emp.firstName} ${emp.lastName}`;
              const isSelected = selectedEmp?._id === emp._id;
              const bg = getAvatarColor(name);
              return (
                <button
                  key={emp._id}
                  onClick={() => {
                    setSelectedEmp(emp);
                    setGenerated(false);
                    setData([]);
                  }}
                  className={cn(
                    "flex items-center gap-2 border-2 p-2.5 text-left transition-all",
                    isSelected
                      ? "border-[#024BAB] bg-[#024BAB]/5"
                      : "border-black/20 bg-white hover:border-black",
                  )}
                >
                  {emp.avatar ? (
                    <img
                      src={emp.avatar}
                      alt={name}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-black/10"
                    />
                  ) : (
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: bg }}
                    >
                      {getInitials(name)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-black truncate">
                      {name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {emp.department?.name || emp.designation}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2: Select Report Type */}
      {selectedEmp && (
        <div className="border-2 border-black bg-white p-5">
          <div className="flex items-center gap-3 mb-4">
            {selectedEmp?.avatar ? (
              <img
                src={selectedEmp.avatar}
                alt={empName}
                className="w-10 h-10 rounded-full object-cover border border-black/10 flex-shrink-0"
              />
            ) : (
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: color }}
              >
                {initials}
              </span>
            )}
            <div>
              <p className="font-bold text-black">{empName}</p>
              <p className="text-xs text-muted-foreground">
                {selectedEmp.employeeId} · {selectedEmp.department?.name} ·{" "}
                {selectedEmp.designation}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedEmp(null);
                setReportType(null);
                setGenerated(false);
              }}
              className="ml-auto border-2 border-black p-1 bg-white hover:bg-gray-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB] mb-3">
            Step 2 — Select Report Type
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {EMP_REPORT_TYPES.map((rt) => (
              <button
                key={rt.id}
                onClick={() => {
                  setReportType(rt.id);
                  setGenerated(false);
                  setData([]);
                }}
                className={cn(
                  "border-2 p-3 text-left transition-all",
                  reportType === rt.id
                    ? "border-[#024BAB] bg-[#024BAB] text-white"
                    : "border-black bg-white hover:border-[#024BAB]",
                )}
              >
                <p
                  className={cn(
                    "text-xs font-bold",
                    reportType === rt.id ? "text-white" : "text-black",
                  )}
                >
                  {rt.label}
                </p>
                <p
                  className={cn(
                    "text-[10px] mt-0.5",
                    reportType === rt.id
                      ? "text-white/70"
                      : "text-muted-foreground",
                  )}
                >
                  {rt.desc}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Period + Generate */}
      {selectedEmp && reportType && (
        <div className="border-2 border-black bg-white p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB]">
            Step 3 — Select Period & Generate
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            {reportType !== "leave" && reportType !== "profile" && (
              <NbSelect value={month} onChange={setMonth} className="w-32">
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </NbSelect>
            )}
            {reportType !== "profile" && (
              <NbSelect value={year} onChange={setYear} className="w-28">
                {YEARS.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </NbSelect>
            )}
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-2 border-2 border-black px-4 py-2 text-sm font-bold bg-[#024BAB] text-white disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Generate
            </button>
            {generated && rows.length > 0 && (
              <>
                <button
                  onClick={() =>
                    printReport(
                      `${EMP_REPORT_TYPES.find((r) => r.id === reportType)?.label} — ${empName}`,
                      period,
                      headers,
                      rows,
                      {
                        company,
                        reportCategory: "Employee",
                        generatedFor: empName,
                      },
                    )
                  }
                  className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white hover:bg-gray-50"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button
                  onClick={() =>
                    exportCSV(
                      [headers, ...rows],
                      `${reportType}_${empName.replace(" ", "_")}_${period}.csv`,
                    )
                  }
                  className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#00C48C] text-white"
                >
                  <Download className="w-4 h-4" /> CSV
                </button>
              </>
            )}
          </div>

          {generated &&
            (rows.length === 0 ? (
              <EmptyState msg="No data for the selected period" />
            ) : (
              <ReportTable id="emp-rpt-tbl" headers={headers} rows={rows} />
            ))}
        </div>
      )}
    </div>
  );
}

function StudentAttendanceReportGen({
  company,
}: {
  departments?: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [status, setStatus] = useState("all");
  const [batch, setBatch] = useState("all");
  const [sport, setSport] = useState("all");
  const [batchOptions, setBatchOptions] = useState<string[]>([]);
  const [sportOptions, setSportOptions] = useState<string[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    studentAPI
      .getAll({ limit: "1000" })
      .then((r) => {
        if (r.success) {
          setBatchOptions(
            Array.from(
              new Set((r.data as any[]).map((s) => s.batch).filter(Boolean)),
            ).sort(),
          );
        }
      })
      .catch(() => {});
    sportAPI
      .getAll()
      .then(
        (r) =>
          r.success && setSportOptions(r.data.map((s: any) => s.name || s)),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [month, year, batch, sport]);
  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { month, year, limit: "500" };
      if (batch !== "all") params.batch = batch;
      if (sport !== "all") params.sport = sport;
      const r = await studentAttendanceAPI.getAll(params);
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const filtered =
    status === "all" ? data : data.filter((rec) => rec.status === status);

  function viaLabel(rec: any): string {
    if (rec.verifyMode === "manual")
      return `Manual — marked by ${rec.markedBy?.name || "staff"}`;
    if (rec.checkInLog)
      return `${rec.checkInLog.method} @ ${rec.checkInLog.location?.name || "—"} (${rec.checkInLog.device?.name || "—"})`;
    return rec.verifyMode || "—";
  }

  const headers = [
    "Date",
    "Student",
    "Student ID",
    "Sport",
    "Batch",
    "Status",
    "Check In",
    "Check Out",
    "Via",
  ];
  const rows = filtered.map((rec) => [
    formatDate(rec.date),
    rec.student ? `${rec.student.firstName} ${rec.student.lastName}` : "—",
    rec.student?.studentId || "—",
    rec.student?.sport || "—",
    rec.batch || rec.student?.batch || "—",
    rec.status?.toUpperCase() || "—",
    rec.checkIn
      ? new Date(rec.checkIn).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    rec.checkOut
      ? new Date(rec.checkOut).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    viaLabel(rec),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={status} onChange={setStatus} className="w-40">
          <option value="all">All Status</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="excused">Excused</option>
        </NbSelect>
        <NbSelect value={batch} onChange={setBatch} className="w-40">
          <option value="all">All Batches</option>
          {batchOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={sport} onChange={setSport} className="w-40">
          <option value="all">All Sports</option>
          {sportOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Student Attendance Report",
                `${MONTHS[+month - 1]} ${year}`,
                headers,
                rows,
                { company, reportCategory: "Student" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `student_attendance_${MONTHS[+month - 1]}_${year}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No student attendance records for this period" />
      ) : (
        <ReportTable id="student-att-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function StudentSubscriptionReportGen({
  company,
}: {
  departments?: any[];
  company: ReportCompany;
}) {
  const [data, setData] = useState<any[]>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportAPI
      .studentFees({ limit: "1000" })
      .then((r) => r.success && setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    status === "all" ? data : data.filter((sub) => sub.status === status);

  function guardianName(sub: any): string {
    const guardians: any[] = sub.student?.guardians || [];
    const byRelation = (rel: string) =>
      guardians.find((g) => g.relation === rel);
    const g = byRelation("father") || byRelation("mother") || guardians[0];
    return g?.name || "—";
  }

  const headers = [
    "Student",
    "Sport",
    "Plan",
    "Billing Cycle",
    "Amount",
    "Start Date",
    "Renewal Date",
    "Status",
    "Payment Status",
    "Amount Paid",
    "Parent/Guardian",
    "Amount Remaining",
    "Verified",
  ];
  const rows = filtered.map((sub) => {
    const due = (sub.amount || 0) - (sub.amountPaid || 0);
    const verified = sub.paymentStatus === "completed" && !!sub.confirmedBy;
    return [
      sub.student ? `${sub.student.firstName} ${sub.student.lastName}` : "—",
      sub.student?.sport || "—",
      sub.planName || sub.plan?.name || "—",
      sub.billingCycle?.toUpperCase() || "—",
      formatCurrency(sub.amount || 0),
      sub.startDate ? formatDate(sub.startDate) : "—",
      sub.renewalDate ? formatDate(sub.renewalDate) : "—",
      sub.status?.toUpperCase().replace("_", " ") || "—",
      sub.paymentStatus?.toUpperCase() || "—",
      formatCurrency(sub.amountPaid || 0),
      guardianName(sub),
      due > 0 ? formatCurrency(due) : "—",
      verified ? "Yes" : "No",
    ];
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={status} onChange={setStatus} className="w-44">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending_renewal">Pending Renewal</option>
          <option value="inactive">Inactive</option>
          <option value="cancelled">Cancelled</option>
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Student Subscription Report",
                new Date().toLocaleDateString("en-IN"),
                headers,
                rows,
                { company, reportCategory: "Student" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV([headers, ...rows], `student_subscriptions.csv`)
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No student subscriptions found" />
      ) : (
        <ReportTable id="student-sub-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function StudentFeeReportGen({
  company,
}: {
  departments?: any[];
  company: ReportCompany;
}) {
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "500" };
      if (status !== "all") params.status = status;
      if (from) params.from = from;
      if (to) params.to = to;
      const r = await reportAPI.studentFees(params);
      if (r.success) setData(r.data);
    } catch (e) {}
    setLoading(false);
  }

  const headers = [
    "Student",
    "Student ID",
    "Sport",
    "Batch",
    "Plan",
    "Billing Cycle",
    "Amount",
    "Amount Paid",
    "Status",
    "Start Date",
    "Renewal Date",
  ];

  const rows = data.map((s) => [
    s.student ? `${s.student.firstName} ${s.student.lastName}` : "—",
    s.student?.studentId || "—",
    s.student?.sport || "—",
    s.student?.batch || "—",
    s.planName || "—",
    s.billingCycle?.toUpperCase() || "—",
    formatCurrency(s.amount || 0),
    formatCurrency(s.amountPaid || 0),
    s.status?.toUpperCase() || "—",
    s.startDate ? formatDate(s.startDate) : "—",
    s.renewalDate ? formatDate(s.renewalDate) : "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={status} onChange={setStatus} className="w-44">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending_renewal">Pending Renewal</option>
          <option value="inactive">Inactive</option>
          <option value="cancelled">Cancelled</option>
        </NbSelect>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="border-2 border-black px-2 py-2"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border-2 border-black px-2 py-2"
        />
        <div className="ml-auto flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Search className="w-4 h-4" /> Load
          </button>
          <button
            onClick={() =>
              printReport(
                "Student Fee Report",
                new Date().toLocaleDateString("en-IN"),
                headers,
                rows,
                { company, reportCategory: "Student" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() => exportCSV([headers, ...rows], `student_fees.csv`)}
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#00C48C] text-white"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No student fee records found" />
      ) : (
        <ReportTable id="student-fee-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function StudentOutstandingDuesGen({
  company,
}: {
  departments?: any[];
  company: ReportCompany;
}) {
  const [minAmount, setMinAmount] = useState(0);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (minAmount) params.minAmount = String(minAmount);
      const r = await reportAPI.studentOutstanding(params);
      if (r.success) setData(r.data);
    } catch (e) {}
    setLoading(false);
  }

  const headers = [
    "Student",
    "Student ID",
    "Plan",
    "Amount",
    "Amount Paid",
    "Due",
    "Status",
    "Renewal Date",
  ];

  const rows = data.map((r) => [
    r.student ? `${r.student.firstName} ${r.student.lastName}` : "—",
    r.student?.studentId || "—",
    r.planName || "—",
    formatCurrency(r.amount || 0),
    formatCurrency(r.amountPaid || 0),
    formatCurrency(r.due || 0),
    r.status?.toUpperCase() || "—",
    r.renewalDate ? formatDate(r.renewalDate) : "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={minAmount}
          onChange={(e) => setMinAmount(Number(e.target.value))}
          className="border-2 border-black px-2 py-2 w-36"
          placeholder="Min due amount"
        />
        <div className="ml-auto flex gap-2">
          <button
            onClick={load}
            className="border-2 border-black px-3 py-2 bg-[#024BAB] text-white font-bold"
          >
            Load
          </button>
          <button
            onClick={() =>
              printReport(
                "Outstanding Dues",
                new Date().toLocaleDateString("en-IN"),
                headers,
                rows,
                { company, reportCategory: "Student" },
              )
            }
            className="border-2 border-black px-3 py-2 bg-white font-bold"
          >
            Print
          </button>
          <button
            onClick={() =>
              exportCSV([headers, ...rows], `student_outstanding.csv`)
            }
            className="border-2 border-black px-3 py-2 bg-[#00C48C] text-white font-bold"
          >
            CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No outstanding dues found" />
      ) : (
        <ReportTable
          id="student-outstanding-tbl"
          headers={headers}
          rows={rows}
        />
      )}
    </div>
  );
}

function TournamentReportGen({
  company,
}: {
  departments?: any[];
  company: ReportCompany;
}) {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    eventAPI.getAll({ eventType: "tournament" }).then((r) => {
      if (r.success) {
        setTournaments(r.data);
        if (r.data.length > 0) setTournamentId(r.data[0]._id);
      }
    });
  }, []);

  useEffect(() => {
    if (!tournamentId) return;
    setLoading(true);
    eventAPI
      .getFixtures(tournamentId)
      .then((r) => r.success && setFixtures(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tournamentId]);

  const tournament = tournaments.find((t) => t._id === tournamentId);

  const headers = [
    "Round",
    "Team A",
    "Team B",
    "Score A",
    "Score B",
    "Winner",
    "Status",
    "Date",
    "Venue",
  ];
  const rows = fixtures
    .sort((a, b) => a.round - b.round || a.matchIndex - b.matchIndex)
    .map((f) => [
      f.roundLabel || `Round ${f.round}`,
      f.teamA?.name || "TBD",
      f.teamB?.name || "TBD",
      f.scoreA ?? "—",
      f.scoreB ?? "—",
      f.winner === "A"
        ? f.teamA?.name || "A"
        : f.winner === "B"
          ? f.teamB?.name || "B"
          : "—",
      f.status?.toUpperCase() || "—",
      f.date ? formatDate(f.date) : "—",
      f.venue || "—",
    ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect
          value={tournamentId}
          onChange={setTournamentId}
          className="w-64"
        >
          {tournaments.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name} ({t.activity})
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                `Tournament Results — ${tournament?.name || ""}`,
                tournament
                  ? `${tournament.activity} · ${tournament.format?.replace("_", " ")}`
                  : "",
                headers,
                rows,
                { company, reportCategory: "Student" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `tournament_${(tournament?.name || "results").replace(/\s+/g, "_")}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : !tournamentId ? (
        <EmptyState msg="No tournaments found" />
      ) : rows.length === 0 ? (
        <EmptyState msg="No fixtures generated for this tournament yet" />
      ) : (
        <ReportTable id="tournament-rpt-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function useSportBatchOptions() {
  const [sportOptions, setSportOptions] = useState<string[]>([]);
  const [batchOptions, setBatchOptions] = useState<string[]>([]);
  useEffect(() => {
    studentAPI
      .getAll({ limit: "1000" })
      .then((r) => {
        if (r.success) {
          setBatchOptions(
            Array.from(
              new Set((r.data as any[]).map((s) => s.batch).filter(Boolean)),
            ).sort(),
          );
        }
      })
      .catch(() => {});
    sportAPI
      .getAll()
      .then(
        (r) =>
          r.success && setSportOptions(r.data.map((s: any) => s.name || s)),
      )
      .catch(() => {});
  }, []);
  return { sportOptions, batchOptions };
}

function guardianRelationName(guardians: any[] | undefined): string {
  const list = guardians || [];
  const byRelation = (rel: string) => list.find((g) => g.relation === rel);
  const g = byRelation("father") || byRelation("mother") || list[0];
  return g?.name || "—";
}

function StudentDirectoryGen({
  company,
}: {
  departments?: any[];
  company: ReportCompany;
}) {
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("all");
  const [batch, setBatch] = useState("all");
  const [status, setStatus] = useState("all");
  const { sportOptions, batchOptions } = useSportBatchOptions();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileGenerated, setProfileGenerated] = useState(false);

  useEffect(() => {
    load();
  }, [search, sport, batch, status]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "200" };
      if (search) params.search = search;
      if (sport !== "all") params.sport = sport;
      if (batch !== "all") params.batch = batch;
      if (status !== "all") params.status = status;
      const r = await studentAPI.getAll(params);
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Student ID",
    "Student",
    "Sport",
    "Batch",
    "Status",
    "Coach",
    "Guardian",
    "Phone",
  ];
  const rows = data.map((s) => [
    s.studentId || "—",
    `${s.firstName} ${s.lastName}`,
    s.sport || "—",
    s.batch || "—",
    (s.status || "").toUpperCase(),
    s.coach ? `${s.coach.firstName} ${s.coach.lastName}` : "—",
    guardianRelationName(s.guardians),
    (s.guardians || [])[0]?.phone || "—",
  ]);

  async function generateProfile() {
    if (!selectedId) return;
    setProfileLoading(true);
    setProfileGenerated(false);
    try {
      const r = await reportAPI.studentProfile(selectedId);
      if (r.success) setProfile(r.data);
    } catch {}
    setProfileLoading(false);
    setProfileGenerated(true);
  }

  function profileRows(): string[][] {
    if (!profile) return [];
    const s = profile.student || {};
    const out: string[][] = [
      ["Student ID", s.studentId || "—"],
      ["Name", `${s.firstName || ""} ${s.lastName || ""}`.trim()],
      ["Sport", s.sport || "—"],
      ["Batch", s.batch || "—"],
      ["Coach", s.coach ? `${s.coach.firstName} ${s.coach.lastName}` : "—"],
      ["Status", (s.status || "").toUpperCase()],
      [
        "Enrollment Date",
        s.enrollmentDate ? formatDate(s.enrollmentDate) : "—",
      ],
    ];
    (s.guardians || []).forEach((g: any) => {
      out.push([
        `Guardian (${g.relation})`,
        `${g.name || "—"} — ${g.phone || "—"}`,
      ]);
    });
    const att = profile.attendance || {};
    out.push(["Attendance — Present", String(att.present ?? 0)]);
    out.push(["Attendance — Late", String(att.late ?? 0)]);
    out.push(["Attendance — Absent", String(att.absent ?? 0)]);
    out.push(["Attendance — Excused", String(att.excused ?? 0)]);
    out.push(["Attendance — Rate", `${att.rate ?? 0}%`]);
    (profile.subscriptions || []).forEach((sub: any) => {
      out.push([
        `Subscription (${sub.startDate ? formatDate(sub.startDate) : "—"})`,
        `${sub.planName || "—"} — ${sub.status || "—"}, paid ${sub.amountPaid ?? 0}/${sub.amount ?? 0}`,
      ]);
    });
    (profile.tournaments || []).forEach((t: any) => {
      out.push([
        "Tournament",
        `${t.eventName || "—"} (${t.activity || "—"}) — ${t.team || "individual"}`,
      ]);
    });
    return out;
  }

  const pRows = profileRows();
  const pHeaders = ["Field", "Value"];
  const selectedName = (() => {
    const s = data.find((d) => d._id === selectedId);
    return s ? `${s.firstName} ${s.lastName}` : "";
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or student ID..."
            className="border-2 border-black pl-9 pr-4 py-2 text-sm font-medium bg-white focus:outline-none w-64"
          />
        </div>
        <NbSelect value={sport} onChange={setSport} className="w-40">
          <option value="all">All Sports</option>
          {sportOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={batch} onChange={setBatch} className="w-40">
          <option value="all">All Batches</option>
          {batchOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={status} onChange={setStatus} className="w-40">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="on_hold">On Hold</option>
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Student Directory",
                new Date().toLocaleDateString("en-IN"),
                headers,
                rows,
                { company, reportCategory: "Student" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV([headers, ...rows], `student_directory.csv`)
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No students match the filters" />
      ) : (
        <ReportTable id="student-dir-tbl" headers={headers} rows={rows} />
      )}

      <div className="border-2 border-black bg-white p-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB]">
          Generate Report Card
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <NbSelect
            value={selectedId}
            onChange={setSelectedId}
            className="w-64"
          >
            <option value="">Select a student…</option>
            {data.map((s) => (
              <option key={s._id} value={s._id}>
                {s.firstName} {s.lastName} ({s.studentId})
              </option>
            ))}
          </NbSelect>
          <button
            onClick={generateProfile}
            disabled={!selectedId || profileLoading}
            className="flex items-center gap-2 border-2 border-black px-4 py-2 text-sm font-bold bg-[#024BAB] text-white disabled:opacity-50"
          >
            {profileLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Generate Report Card
          </button>
          {profileGenerated && pRows.length > 0 && (
            <>
              <button
                onClick={() =>
                  printReport(
                    `Student Report Card — ${selectedName}`,
                    new Date().toLocaleDateString("en-IN"),
                    pHeaders,
                    pRows,
                    {
                      company,
                      reportCategory: "Student",
                      generatedFor: selectedName,
                    },
                  )
                }
                className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
              <button
                onClick={() =>
                  exportCSV(
                    [pHeaders, ...pRows],
                    `report_card_${selectedName.replace(/\s+/g, "_")}.csv`,
                  )
                }
                className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#00C48C] text-white"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
            </>
          )}
        </div>
        {profileGenerated &&
          (pRows.length === 0 ? (
            <EmptyState msg="No profile data found for this student" />
          ) : (
            <ReportTable
              id="student-report-card-tbl"
              headers={pHeaders}
              rows={pRows}
            />
          ))}
      </div>
    </div>
  );
}

function StudentPerformanceGen({
  company,
}: {
  departments?: any[];
  company: ReportCompany;
}) {
  const [sport, setSport] = useState("all");
  const [batch, setBatch] = useState("all");
  const { sportOptions, batchOptions } = useSportBatchOptions();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [sport, batch]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (sport !== "all") params.sport = sport;
      if (batch !== "all") params.batch = batch;
      const r = await reportAPI.studentPerformance(params);
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Student",
    "Sport",
    "Batch",
    "Attendance %",
    "Tournaments Participated",
    "Fee Status",
  ];
  const rows = data.map((r) => [
    r.student ? `${r.student.firstName} ${r.student.lastName}` : "—",
    r.student?.sport || "—",
    r.student?.batch || "—",
    `${r.attendanceRate ?? 0}%`,
    String(r.tournamentsCount ?? 0),
    (r.feeStatus || "—").toUpperCase().replace(/_/g, " "),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={sport} onChange={setSport} className="w-40">
          <option value="all">All Sports</option>
          {sportOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={batch} onChange={setBatch} className="w-40">
          <option value="all">All Batches</option>
          {batchOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Student Performance Report",
                new Date().toLocaleDateString("en-IN"),
                headers,
                rows,
                { company, reportCategory: "Student" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV([headers, ...rows], `student_performance.csv`)
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No student performance data found" />
      ) : (
        <ReportTable id="student-perf-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function StudentEnrollmentGen({
  company,
}: {
  departments?: any[];
  company: ReportCompany;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<{
    newEnrollments: number;
    exits: number;
    netChange: number;
  }>({ newEnrollments: 0, exits: 0, netChange: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const r = await reportAPI.studentEnrollment(params);
      if (r.success) {
        setData(r.data);
        if (r.summary) setSummary(r.summary);
      }
    } catch {}
    setLoading(false);
  }

  const headers = ["Type", "Student", "Student ID", "Sport", "Batch", "Date"];
  const rows = data.map((e) => [
    e.type === "enrolled" ? "Enrolled" : "Exited",
    e.student ? `${e.student.firstName} ${e.student.lastName}` : "—",
    e.student?.studentId || "—",
    e.student?.sport || "—",
    e.student?.batch || "—",
    e.date ? formatDate(e.date) : "—",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="border-2 border-black px-2 py-2"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border-2 border-black px-2 py-2"
        />
        <button
          onClick={load}
          className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
        >
          <Search className="w-4 h-4" /> Load
        </button>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Student Enrollment Report",
                from || to ? `${from || "…"} to ${to || "…"}` : "All Time",
                headers,
                rows,
                { company, reportCategory: "Student" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV([headers, ...rows], `student_enrollment.csv`)
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#00C48C] text-white"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>
      <p className="text-sm font-bold text-black">
        New: {summary.newEnrollments} &nbsp; Exits: {summary.exits} &nbsp; Net:{" "}
        {summary.netChange}
      </p>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No enrollment activity for this period" />
      ) : (
        <ReportTable id="student-enroll-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function BatchSummaryGen({
  company,
}: {
  departments?: any[];
  company: ReportCompany;
}) {
  const { batchOptions } = useSportBatchOptions();
  const [batch, setBatch] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [batch]);

  async function load() {
    setLoading(true);
    try {
      const r = await reportAPI.batchSummary(batch ? { batch } : undefined);
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = batch
    ? ["Student", "Sport", "Attendance %", "Fee Status"]
    : ["Batch", "Total", "Active", "Inactive", "On Hold"];
  const rows = batch
    ? data.map((r) => [
        r.student ? `${r.student.firstName} ${r.student.lastName}` : "—",
        r.student?.sport || "—",
        `${r.attendanceRate ?? 0}%`,
        (r.feeStatus || "—").toUpperCase().replace(/_/g, " "),
      ])
    : data.map((b) => [
        b.batch || "—",
        String(b.total ?? 0),
        String(b.active ?? 0),
        String(b.inactive ?? 0),
        String(b.on_hold ?? 0),
      ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={batch} onChange={setBatch} className="w-48">
          <option value="">All Batches</option>
          {batchOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Batch Summary Report",
                batch || "All Batches",
                headers,
                rows,
                { company, reportCategory: "Student" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `batch_summary${batch ? `_${batch}` : ""}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No batch data found" />
      ) : (
        <ReportTable id="batch-summary-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function SportSummaryGen({
  company,
}: {
  departments?: any[];
  company: ReportCompany;
}) {
  const [sportOptions, setSportOptions] = useState<string[]>([]);
  const [sport, setSport] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sportAPI
      .getAll()
      .then(
        (r) =>
          r.success && setSportOptions(r.data.map((s: any) => s.name || s)),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [sport]);

  async function load() {
    setLoading(true);
    try {
      const r = await reportAPI.sportSummary(sport ? { sport } : undefined);
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = sport
    ? ["Student", "Batch", "Attendance %", "Fee Status"]
    : ["Sport", "Total", "Active", "Revenue"];
  const rows = sport
    ? data.map((r) => [
        r.student ? `${r.student.firstName} ${r.student.lastName}` : "—",
        r.student?.batch || "—",
        `${r.attendanceRate ?? 0}%`,
        (r.feeStatus || "—").toUpperCase().replace(/_/g, " "),
      ])
    : data.map((s) => [
        s.sport || "—",
        String(s.total ?? 0),
        String(s.active ?? 0),
        formatCurrency(s.revenue || 0),
      ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={sport} onChange={setSport} className="w-48">
          <option value="">All Sports</option>
          {sportOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Sport-wise Summary",
                sport || "All Sports",
                headers,
                rows,
                { company, reportCategory: "Student" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `sport_summary${sport ? `_${sport}` : ""}.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No sport data found" />
      ) : (
        <ReportTable id="sport-summary-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function GuardianContactListGen({
  company,
}: {
  departments?: any[];
  company: ReportCompany;
}) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentAPI
      .getAll({ limit: "1000" })
      .then((r) => r.success && setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const headers = [
    "Student",
    "Student ID",
    "Father Name",
    "Father Phone",
    "Mother Name",
    "Mother Phone",
    "Guardian 1 Name",
    "Guardian 1 Phone",
    "Guardian 2 Name",
    "Guardian 2 Phone",
  ];
  const rows = data.map((s) => {
    const guardians: any[] = s.guardians || [];
    const father = guardians.find((g) => g.relation === "father");
    const mother = guardians.find((g) => g.relation === "mother");
    const others = guardians.filter(
      (g) => g.relation !== "father" && g.relation !== "mother",
    );
    return [
      `${s.firstName} ${s.lastName}`,
      s.studentId || "—",
      father?.name || "—",
      father?.phone || "—",
      mother?.name || "—",
      mother?.phone || "—",
      others[0]?.name || "—",
      others[0]?.phone || "—",
      others[1]?.name || "—",
      others[1]?.phone || "—",
    ];
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Guardian Contact List",
                new Date().toLocaleDateString("en-IN"),
                headers,
                rows,
                { company, reportCategory: "Student" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV([headers, ...rows], `guardian_contact_list.csv`)
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No students found" />
      ) : (
        <ReportTable id="guardian-list-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

function StudentPaymentHistoryGen({
  company,
}: {
  departments?: any[];
  company: ReportCompany;
}) {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentAPI
      .getAll({ limit: "1000" })
      .then((r) => r.success && setStudents(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [selectedId]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "1000" };
      if (selectedId) params.student = selectedId;
      const r = await reportAPI.studentFees(params);
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Student",
    "Plan",
    "Amount",
    "Amount Paid",
    "Due",
    "Payment Method",
    "UTR/Transaction No.",
    "Status",
    "Verified",
    "Verified By",
    "Date",
  ];
  const rows = data.map((s) => {
    const due = (s.amount || 0) - (s.amountPaid || 0);
    const verified = s.paymentStatus === "completed" && !!s.confirmedBy;
    const utr = [s.qrReferenceNumber, s.transactionNumber]
      .filter(Boolean)
      .join(" / ");
    return [
      s.student ? `${s.student.firstName} ${s.student.lastName}` : "—",
      s.planName || "—",
      formatCurrency(s.amount || 0),
      formatCurrency(s.amountPaid || 0),
      formatCurrency(due > 0 ? due : 0),
      (s.paymentMethod || "—").toUpperCase(),
      utr || "—",
      (s.paymentStatus || "—").toUpperCase(),
      verified ? "Yes" : "No",
      s.confirmedBy?.name || s.rejectedBy?.name || "—",
      s.startDate ? formatDate(s.startDate) : "—",
    ];
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <NbSelect value={selectedId} onChange={setSelectedId} className="w-64">
          <option value="">All Students</option>
          {students.map((s) => (
            <option key={s._id} value={s._id}>
              {s.firstName} {s.lastName} ({s.studentId})
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              printReport(
                "Student Payment History",
                new Date().toLocaleDateString("en-IN"),
                headers,
                rows,
                { company, reportCategory: "Student" },
              )
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() =>
              exportCSV([headers, ...rows], `student_payment_history.csv`)
            }
            className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState msg="No payment history found" />
      ) : (
        <ReportTable
          id="student-payment-history-tbl"
          headers={headers}
          rows={rows}
        />
      )}
    </div>
  );
}

function ComingSoonGen({}: { departments?: any[]; company: ReportCompany }) {
  return (
    <div className="border-2 bg-white p-12 flex flex-col items-center gap-4">
      <div className="w-16 h-16 border-2 border-black bg-[#024BAB]/10 flex items-center justify-center">
        <FileText className="w-8 h-8 text-[#024BAB]" />
      </div>
      <div className="text-center">
        <p className="font-bold text-black text-lg">Coming Soon</p>
        <p className="text-sm text-muted-foreground mt-1">
          This report requires additional data configuration.
          <br />
          It will be available in a future update.
        </p>
      </div>
    </div>
  );
}

function TallyExportGen({
  departments: _d,
  company: _c,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [month, year]);
  async function load() {
    setLoading(true);
    try {
      const r = await payrollAPI.getAll({ month, year, limit: "500" });
      if (r.success) setData(r.data);
    } catch {}
    setLoading(false);
  }

  const headers = [
    "Employee Name",
    "Employee ID",
    "Designation",
    "Department",
    "Basic Salary",
    "Earned Basic",
    "Allowances",
    "Overtime Pay",
    "Gross Salary",
    "Absent Deduction",
    "Late Deduction",
    "Half Day Deduction",
    "Penalty",
    "Loan / Advance EMI",
    "Total Deductions",
    "Net Salary",
    "Working Days",
    "Days Present",
    "Leave Days",
    "Absent Days",
    "Hours Worked",
    "Status",
  ];
  const rows = data.map((p) => {
    const emp = p.employee || {};
    return [
      `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
      emp.employeeId || "",
      emp.designation || "",
      emp.department?.name || "",
      p.basicSalary || 0,
      p.earnedBasic ?? p.basicSalary ?? 0,
      p.otherAllowances || 0,
      p.otPay || 0,
      p.grossSalary || 0,
      p.absentDeduction || 0,
      p.lateDeductionAmount || 0,
      p.halfDayDeduction || 0,
      p.penaltyAmount || 0,
      p.loanDeduction || 0,
      p.totalDeductions || 0,
      p.netSalary || 0,
      p.workingDays || 0,
      p.presentDays || 0,
      p.leaveDays || 0,
      p.absentDays || 0,
      Number(p.totalWorkHours ?? 0).toFixed(2),
      p.status || "",
    ].map(String);
  });

  return (
    <div className="space-y-4">
      <div className="border-2 bg-[#F0FDF4] border-green-300 p-4 text-sm text-green-800 font-medium">
        Export monthly payroll as CSV and import directly into Tally ERP via{" "}
        <b>Gateway of Tally → Import → Vouchers</b>.
      </div>
      <div className="flex flex-wrap gap-3">
        <NbSelect value={month} onChange={setMonth} className="w-32">
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </NbSelect>
        <NbSelect value={year} onChange={setYear} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </NbSelect>
        <div className="ml-auto flex gap-2">
          <button
            disabled={data.length === 0}
            onClick={() =>
              exportCSV(
                [headers, ...rows],
                `Payroll_${MONTHS[+month - 1]}_${year}_Tally.csv`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-4 py-2 text-sm font-bold bg-[#16A34A] text-white disabled:opacity-40"
          >
            <Download className="w-4 h-4" /> Download CSV
          </button>
          <button
            disabled={data.length === 0}
            onClick={() =>
              exportXLSX(
                [headers, ...rows],
                `Payroll_${MONTHS[+month - 1]}_${year}_Tally.xlsx`,
              )
            }
            className="flex items-center gap-2 border-2 border-black px-4 py-2 text-sm font-bold bg-[#00C48C] text-white disabled:opacity-40"
          >
            <Download className="w-4 h-4" /> Download Excel
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState msg="No payroll records for this period" />
      ) : (
        <ReportTable id="tally-tbl" headers={headers} rows={rows} />
      )}
    </div>
  );
}

const REPORT_COMPONENT: Record<
  string,
  React.ComponentType<{ departments: any[]; company: ReportCompany }>
> = {
  "tally-export": TallyExportGen,
  "pay-report": PayReportGen,
  "salary-register": SalaryRegisterGen,
  "net-salary": NetSalaryGen,
  "salary-slip": SalarySlipGen,
  "pf-register": PFRegisterGen,
  "esic-register": ESICRegisterGen,
  "bank-upload": BankUploadGen,
  "absent-leave-summary": AbsentLeaveSummaryGen,
  "late-coming-summary": LateComingGen,
  "designation-summary": DesignationSummaryGen,
  "attendance-report": AttendanceReportGen,
  "attendance-inout": AttendanceInOutGen,
  "attendance-summary": AttendanceSummaryGen,
  "leave-report": LeaveReportGen,
  "miss-punch": MissPunchGen,
  "employee-directory": EmployeeDirectoryGen,
  "employee-report": EmployeeReportGen,
  "student-attendance-report": StudentAttendanceReportGen,
  "student-subscription-report": StudentSubscriptionReportGen,
  "student-fee-report": StudentFeeReportGen,
  "student-outstanding-dues": StudentOutstandingDuesGen,
  "tournament-report": TournamentReportGen,
  "student-directory": StudentDirectoryGen,
  "student-performance": StudentPerformanceGen,
  "student-enrollment": StudentEnrollmentGen,
  "student-batch-summary": BatchSummaryGen,
  "student-sport-summary": SportSummaryGen,
  "student-guardian-list": GuardianContactListGen,
  "student-payment-history": StudentPaymentHistoryGen,
};

const CATEGORY_META: Record<
  Category,
  { label: string; color: string; count: number }
> = {
  payroll: { label: "PayRoll", color: "#024BAB", count: 0 },
  attendance: { label: "Attendance", color: "#00C48C", count: 0 },
  employee: { label: "Employee", color: "#FA731C", count: 0 },
  student: { label: "Student", color: "#A855F7", count: 0 },
};

const CHART_COLORS = [
  "#024BAB",
  "#FA731C",
  "#00C48C",
  "#A855F7",
  "#EF4444",
  "#FFD60A",
];

function AnalyticsTab({
  departments,
  company,
}: {
  departments: any[];
  company: ReportCompany;
}) {
  const now = new Date();
  const [attTab, setAttTab] = useState("headcount");
  const [employees, setEmployees] = useState<any[]>([]);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      employeeAPI.getAll({ limit: "500", status: "active" }),
      payrollAPI.getAll({
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
        limit: "500",
      }),
      attendanceAPI.getAll({
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
        limit: "500",
      }),
    ])
      .then(([e, p, a]) => {
        if (e.success) setEmployees(e.data);
        if (p.success) setPayrolls(p.data);
        if (a.success) setAttendance(a.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const deptData = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        count: number;
        male: number;
        female: number;
        salary: number;
      }
    >();
    employees.forEach((e) => {
      const name = e.department?.name || "No Dept";
      if (!map.has(name))
        map.set(name, { name, count: 0, male: 0, female: 0, salary: 0 });
      const d = map.get(name)!;
      d.count++;
      d.salary += e.salary || 0;
      if (e.gender === "male") d.male++;
      else if (e.gender === "female") d.female++;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [employees]);

  const attSummary = useMemo(
    () => ({
      present: attendance.filter((a) => a.status === "present").length,
      late: attendance.filter((a) => a.status === "late").length,
      absent: attendance.filter((a) => a.status === "absent").length,
      leave: attendance.filter((a) => a.status === "on_leave").length,
    }),
    [attendance],
  );

  const payrollSummary = useMemo(
    () => ({
      gross: payrolls.reduce((s, p) => s + (p.grossSalary || 0), 0),
      net: payrolls.reduce((s, p) => s + (p.netSalary || 0), 0),
      ded: payrolls.reduce((s, p) => s + (p.totalDeductions || 0), 0),
      pf: payrolls.reduce((s, p) => s + (p.pf || 0), 0),
      esi: payrolls.reduce((s, p) => s + (p.esi || 0), 0),
      tds: payrolls.reduce((s, p) => s + (p.tds || 0), 0),
    }),
    [payrolls],
  );

  const TABS = [
    { id: "headcount", label: "Headcount" },
    { id: "attendance", label: "Attendance" },
    { id: "salary", label: "Salary" },
    { id: "compliance", label: "PF / ESI" },
  ];

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
      </div>
    );

  return (
    <div className="space-y-5">
      {}
      <div className="flex gap-0 border-2 border-black w-fit">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setAttTab(id)}
            className={cn(
              "px-4 py-2 text-sm font-bold border-r-2 border-black last:border-r-0 transition-all",
              attTab === id
                ? "bg-[#024BAB] text-white"
                : "bg-white text-black hover:bg-gray-50",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {attTab === "headcount" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Total Active",
                value: employees.length,
                color: "#024BAB",
              },
              {
                label: "Male",
                value: employees.filter((e) => e.gender === "male").length,
                color: "#00C48C",
              },
              {
                label: "Female",
                value: employees.filter((e) => e.gender === "female").length,
                color: "#FA731C",
              },
              {
                label: "Departments",
                value: deptData.length,
                color: "#A855F7",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="border-2 bg-white p-4">
                <p className="text-2xl font-bold" style={{ color }}>
                  {value}
                </p>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border-2 bg-white p-5">
              <h3 className="font-bold text-sm text-black mb-3">
                Dept Headcount
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={deptData} barCategoryGap="35%">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#E5E7EB"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fontWeight: 700 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={24}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Employees"
                    stroke="#0A0A0A"
                    strokeWidth={1}
                  >
                    {deptData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="border-2 bg-white p-5">
              <h3 className="font-bold text-sm text-black mb-3">
                Dept Breakdown Table
              </h3>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-black">
                      {["Dept", "Total", "Male", "Female", "Avg Salary"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left font-bold uppercase tracking-wider text-muted-foreground"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {deptData.map((d, i) => (
                      <tr
                        key={d.name}
                        className={cn(
                          "border-b border-black/10",
                          i % 2 !== 0 && "bg-[#F8FAFF]",
                        )}
                      >
                        <td className="px-3 py-2 font-bold text-black">
                          {d.name}
                        </td>
                        <td className="px-3 py-2">{d.count}</td>
                        <td className="px-3 py-2">{d.male}</td>
                        <td className="px-3 py-2">{d.female}</td>
                        <td className="px-3 py-2">
                          {d.count > 0
                            ? formatCurrency(Math.round(d.salary / d.count))
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {attTab === "attendance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Present", value: attSummary.present, color: "#00C48C" },
              { label: "Late", value: attSummary.late, color: "#FA731C" },
              { label: "Absent", value: attSummary.absent, color: "#EF4444" },
              { label: "On Leave", value: attSummary.leave, color: "#024BAB" },
            ].map(({ label, value, color }) => (
              <div key={label} className="border-2 bg-white p-4">
                <p className="text-2xl font-bold" style={{ color }}>
                  {value}
                </p>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <div className="border-2 bg-white p-5">
            <h3 className="font-bold text-sm text-black mb-3">
              Attendance Distribution
            </h3>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "Present",
                        value: attSummary.present,
                        color: "#00C48C",
                      },
                      {
                        name: "Late",
                        value: attSummary.late,
                        color: "#FA731C",
                      },
                      {
                        name: "Absent",
                        value: attSummary.absent,
                        color: "#EF4444",
                      },
                      {
                        name: "On Leave",
                        value: attSummary.leave,
                        color: "#024BAB",
                      },
                    ].filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="#0A0A0A"
                    strokeWidth={2}
                  >
                    {[
                      attSummary.present,
                      attSummary.late,
                      attSummary.absent,
                      attSummary.leave,
                    ].map((_, i) => (
                      <Cell
                        key={i}
                        fill={["#00C48C", "#FA731C", "#EF4444", "#024BAB"][i]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {[
                  {
                    label: "Present",
                    value: attSummary.present,
                    color: "#00C48C",
                  },
                  { label: "Late", value: attSummary.late, color: "#FA731C" },
                  {
                    label: "Absent",
                    value: attSummary.absent,
                    color: "#EF4444",
                  },
                  {
                    label: "On Leave",
                    value: attSummary.leave,
                    color: "#024BAB",
                  },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 border border-black"
                        style={{ background: color }}
                      />
                      <span className="text-xs font-bold text-black">
                        {label}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-black">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {attTab === "salary" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                label: "Total Gross",
                value: formatCurrency(payrollSummary.gross),
                color: "#024BAB",
              },
              {
                label: "Total Net",
                value: formatCurrency(payrollSummary.net),
                color: "#00C48C",
              },
              {
                label: "Total Deductions",
                value: formatCurrency(payrollSummary.ded),
                color: "#EF4444",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="border-2 bg-white p-4">
                <p className="text-xl font-bold" style={{ color }}>
                  {value}
                </p>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <div className="border-2 bg-white p-5">
            <h3 className="font-bold text-sm text-black mb-3">
              Dept-wise Payroll
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={deptData.map((d) => ({ name: d.name, salary: d.salary }))}
                barCategoryGap="35%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E5E7EB"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar
                  dataKey="salary"
                  name="Total Salary"
                  fill="#024BAB"
                  stroke="#0A0A0A"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {attTab === "compliance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                label: "PF Contribution",
                value: formatCurrency(payrollSummary.pf * 2),
                color: "#024BAB",
                sub: "Employee + Employer",
              },
              {
                label: "ESI Contribution",
                value: formatCurrency(payrollSummary.esi),
                color: "#00C48C",
                sub: "Employee share",
              },
              {
                label: "TDS Collected",
                value: formatCurrency(payrollSummary.tds),
                color: "#FA731C",
                sub: "This month",
              },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="border-2 bg-white p-4">
                <p className="text-xl font-bold" style={{ color }}>
                  {value}
                </p>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                  {label}
                </p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>
          {payrolls.length > 0 ? (
            <div className="border-2 bg-white overflow-hidden">
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-black bg-[#024BAB]/5">
                      {[
                        "Employee",
                        "Gross",
                        "PF (Emp)",
                        "PF (Employer)",
                        "ESI",
                        "TDS",
                        "Status",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left font-bold uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payrolls.map((p, i) => (
                      <tr
                        key={p._id}
                        className={cn(
                          "border-b border-black/10",
                          i % 2 !== 0 && "bg-[#F8FAFF]",
                        )}
                      >
                        <td className="px-4 py-2.5 font-bold text-black">
                          {p.employee
                            ? `${p.employee.firstName} ${p.employee.lastName}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrency(p.grossSalary || 0)}
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrency(p.pf || 0)}
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrency(p.pf || 0)}
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrency(p.esi || 0)}
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrency(p.tds || 0)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              "border-2 text-[10px]",
                              p.status === "paid"
                                ? "bg-[#00C48C] text-white border-black"
                                : "bg-[#FA731C] text-white border-black",
                            )}
                          >
                            {p.status?.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState msg="No payroll data for this month" />
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [company, setCompany] = useState<ReportCompany>({ name: "NestSports" });
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<Category | "all">("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pageMode, setPageMode] = useState<"catalog" | "analytics">("catalog");

  useEffect(() => {
    departmentAPI
      .getAll()
      .then((r) => r.success && setDepartments(r.data))
      .catch(() => {});
    settingsAPI
      .get()
      .then((r) => {
        if (r.success && r.data) {
          setCompany({
            name: r.data.companyName || "NestSports",
            logo: r.data.logoUrl || undefined,
          });
        }
      })
      .catch(() => {});
  }, []);

  const filtered = REPORTS.filter((r) => {
    const matchCat = filterCat === "all" || r.category === filterCat;
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.desc.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const grouped: Record<Category, ReportDef[]> = {
    payroll: [],
    attendance: [],
    employee: [],
    student: [],
  };
  filtered.forEach((r) => grouped[r.category].push(r));

  const activeReport = REPORTS.find((r) => r.id === activeId);
  const ActiveComponent = activeId
    ? REPORT_COMPONENT[activeId] || ComingSoonGen
    : null;

  const catCounts: Record<Category, number> = {
    payroll: 0,
    attendance: 0,
    employee: 0,
    student: 0,
  };
  REPORTS.forEach((r) => catCounts[r.category]++);

  return (
    <AppLayout title="Reports">
      {}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-black">
            Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate, filter, and export HR reports
          </p>
        </div>
        <div className="flex gap-0 border-2 border-black shrink-0">
          <button
            onClick={() => setPageMode("catalog")}
            className={cn(
              "px-4 py-2 text-sm font-bold border-r-2 border-black transition-all",
              pageMode === "catalog"
                ? "bg-black text-white"
                : "bg-white text-black hover:bg-gray-50",
            )}
          >
            All Reports
          </button>
          <button
            onClick={() => setPageMode("analytics")}
            className={cn(
              "px-4 py-2 text-sm font-bold transition-all",
              pageMode === "analytics"
                ? "bg-black text-white"
                : "bg-white text-black hover:bg-gray-50",
            )}
          >
            Analytics
          </button>
        </div>
      </div>

      {}
      {pageMode === "analytics" && (
        <AnalyticsTab departments={departments} company={company} />
      )}

      {}
      {pageMode === "catalog" && (
        <>
          {}
          {activeId && activeReport && ActiveComponent && (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setActiveId(null)}
                  className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" /> All Reports
                </button>
                <div className="flex items-center gap-2">
                  <CategoryTag cat={activeReport.category} />
                  <h2 className="text-xl font-bold text-black">
                    {activeReport.name}
                  </h2>
                </div>
                <button
                  onClick={() => setActiveId(null)}
                  className="ml-auto border-2 border-black p-1.5 bg-white hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="border-2 bg-white p-5">
                <ActiveComponent departments={departments} company={company} />
              </div>
            </div>
          )}

          {}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border-2 border-black pl-9 pr-4 py-2.5 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
              />
            </div>
            <div className="flex gap-1 border-2 border-black">
              {(
                [
                  ["all", "All"],
                  ["payroll", "PayRoll"],
                  ["attendance", "Attendance"],
                  ["employee", "Employee"],
                  ["student", "Student"],
                ] as [Category | "all", string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFilterCat(id)}
                  className={cn(
                    "px-4 py-2 text-sm font-bold border-r-2 border-black last:border-r-0 transition-all",
                    filterCat === id
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-gray-50",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {}
          <div className="flex gap-3 mb-6">
            {(Object.entries(catCounts) as [Category, number][]).map(
              ([cat, count]) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 border-2 border-black px-3 py-1.5 bg-white"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-none"
                    style={{ backgroundColor: CATEGORY_META[cat].color }}
                  />
                  <span className="text-xs font-bold text-black uppercase tracking-wider">
                    {CATEGORY_META[cat].label}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">
                    {count} reports
                  </span>
                </div>
              ),
            )}
          </div>

          {}
          {(["payroll", "attendance", "employee", "student"] as Category[]).map(
            (cat) => {
              const catReports = grouped[cat];
              if (catReports.length === 0) return null;
              return (
                <div key={cat} className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="h-5 w-1 border border-black"
                      style={{ backgroundColor: CATEGORY_META[cat].color }}
                    />
                    <h2 className="text-base font-bold text-black uppercase tracking-wider">
                      {CATEGORY_META[cat].label} ({catReports.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {catReports.map((report) => {
                      const Icon = report.icon;
                      const isActive = activeId === report.id;
                      return (
                        <div
                          key={report.id}
                          className={cn(
                            "border-2 bg-white p-4 flex flex-col gap-3 transition-all",
                            isActive && "border-[#024BAB] bg-[#F0F6FF]",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "w-10 h-10 border-2 border-black flex items-center justify-center flex-shrink-0",
                                report.available
                                  ? "bg-[#024BAB]"
                                  : "bg-gray-200",
                              )}
                            >
                              <Icon
                                className={cn(
                                  "w-5 h-5",
                                  report.available
                                    ? "text-white"
                                    : "text-gray-400",
                                )}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <CategoryTag cat={report.category} />
                                {!report.available && (
                                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-black bg-gray-100 text-gray-500">
                                    Coming Soon
                                  </span>
                                )}
                              </div>
                              <p className="font-bold text-black text-sm leading-tight">
                                {report.name}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                            {report.desc}
                          </p>
                          <button
                            onClick={() =>
                              setActiveId(isActive ? null : report.id)
                            }
                            disabled={!report.available}
                            className={cn(
                              "w-full py-2 text-sm font-bold border-2 border-black transition-all",
                              isActive
                                ? "bg-black text-white"
                                : report.available
                                  ? "bg-white text-black hover:bg-[#024BAB] hover:text-white border-2"
                                  : "bg-gray-100 text-gray-400 cursor-not-allowed",
                            )}
                          >
                            {isActive
                              ? "Close Report"
                              : report.available
                                ? "Generate"
                                : "Unavailable"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            },
          )}

          {filtered.length === 0 && (
            <EmptyState msg={`No reports found matching "${search}"`} />
          )}
        </>
      )}
    </AppLayout>
  );
}
