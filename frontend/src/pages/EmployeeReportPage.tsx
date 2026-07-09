import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { buildReportHTML } from "@/lib/reportPrintHTML";
import { employeeAPI, attendanceAPI, payrollAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  BarChart2,
  Calendar,
  Download,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Minus,
  Sun,
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

interface AttendanceRecord {
  _id: string;
  date: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
}

function fmt(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function statusIcon(s: string) {
  if (s === "present")
    return <CheckCircle className="w-4 h-4 text-[#00C48C]" />;
  if (s === "late") return <Clock className="w-4 h-4 text-[#FA731C]" />;
  if (s === "absent") return <XCircle className="w-4 h-4 text-red-500" />;
  if (s === "half_day") return <Minus className="w-4 h-4 text-yellow-500" />;
  if (s === "holiday" || s === "weekend")
    return <Sun className="w-4 h-4 text-gray-400" />;
  return <Minus className="w-4 h-4 text-gray-300" />;
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    present: "Present",
    late: "Late",
    absent: "Absent",
    half_day: "Half Day",
    on_leave: "Leave",
    holiday: "Holiday",
    weekend: "Weekend",
  };
  return map[s] ?? s;
}

export default function EmployeeReportPage() {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [empId, setEmpId] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [payroll, setPayroll] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    employeeAPI
      .getAll({ search: user.email })
      .then((res) => {
        if (res.success && res.data?.length > 0) setEmpId(res.data[0]._id);
      })
      .catch(() => {});
  }, [user]);

  const load = useCallback(async () => {
    if (!empId) return;
    setLoading(true);
    try {
      const [attRes, payRes] = await Promise.all([
        attendanceAPI.getAll({
          employeeId: empId,
          month: String(month),
          year: String(year),
          limit: "60",
        }),
        payrollAPI.getMy({ month: String(month), year: String(year) }),
      ]);
      const sorted = (attRes.data || []).sort(
        (a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      setRecords(sorted);
      setPayroll(payRes.data?.[0] ?? null);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [empId, month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const present = records.filter(
    (r) => r.status === "present" || r.status === "late",
  ).length;
  const absent = records.filter((r) => r.status === "absent").length;
  const late = records.filter((r) => r.status === "late").length;
  const halfDay = records.filter((r) => r.status === "half_day").length;
  const onLeave = records.filter((r) => r.status === "on_leave").length;
  const holidays = records.filter(
    (r) => r.status === "holiday" || r.status === "weekend",
  ).length;
  const total = records.length - holidays;

  const handlePrint = () => {
    const headers = ["Date", "Status", "Check In", "Check Out", "Hours"];
    const tableRows = records
      .filter((r) => r.status !== "weekend" && r.status !== "holiday")
      .map((r) => {
        const hours =
          r.checkIn && r.checkOut
            ? (
                (new Date(r.checkOut).getTime() -
                  new Date(r.checkIn).getTime()) /
                3600000
              ).toFixed(1) + "h"
            : "—";
        return [
          new Date(r.date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            weekday: "short",
          }),
          statusLabel(r.status).toUpperCase(),
          fmt(r.checkIn),
          fmt(r.checkOut),
          hours,
        ];
      });
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildReportHTML(
        `Attendance Report`,
        `${MONTHS[month - 1]} ${year}`,
        headers,
        tableRows,
      ),
    );
    win.document.close();
  };

  return (
    <AppLayout title="My Report">
      <div className="w-full mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-3xl text-black">
              My Report
            </h1>
            <p className="text-gray-600 font-medium mt-1">
              Monthly attendance summary and payroll snapshot
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="border-2 border-black px-3 py-2 text-sm font-bold bg-white focus:outline-none"
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
              className="border-2 border-black px-3 py-2 text-sm font-bold bg-white focus:outline-none"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              onClick={handlePrint}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold disabled:opacity-40 hover:bg-[#024BAB]/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            {
              label: "Present",
              value: present,
              color: "text-[#00C48C]",
              icon: CheckCircle,
            },
            {
              label: "Absent",
              value: absent,
              color: "text-red-500",
              icon: XCircle,
            },
            {
              label: "Late",
              value: late,
              color: "text-[#FA731C]",
              icon: Clock,
            },
            {
              label: "Half Day",
              value: halfDay,
              color: "text-yellow-500",
              icon: Minus,
            },
            {
              label: "On Leave",
              value: onLeave,
              color: "text-[#024BAB]",
              icon: Calendar,
            },
            {
              label: "Working",
              value: total,
              color: "text-gray-600",
              icon: BarChart2,
            },
          ].map(({ label, value, color, icon: Icon }) => (
            <div
              key={label}
              className="bg-white border-2 border-black p-3 text-center"
            >
              <Icon className={`w-5 h-5 ${color} mx-auto mb-1`} />
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-[10px] font-bold uppercase text-gray-400">
                {label}
              </p>
            </div>
          ))}
        </div>

        {}
        {payroll && (
          <div className="bg-[#024BAB] border-2 border-black p-4 mb-6 flex flex-wrap items-center gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase text-white/60">
                Payroll — {MONTHS[month - 1]} {year}
              </p>
              <p className="text-xs font-bold text-white capitalize">
                {payroll.status}
              </p>
            </div>
            {[
              {
                label: "Salary",
                value: `₹${Math.round(payroll.basicSalary).toLocaleString("en-IN")}`,
              },
              {
                label: "Deductions",
                value: `-₹${Math.round(payroll.totalDeductions).toLocaleString("en-IN")}`,
              },
              {
                label: "Net Pay",
                value: `₹${Math.round(payroll.netSalary).toLocaleString("en-IN")}`,
              },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-bold uppercase text-white/60">
                  {label}
                </p>
                <p className="text-base font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
        )}

        {}
        {loading ? (
          <div className="flex justify-center py-16">
            <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
          </div>
        ) : records.length === 0 ? (
          <div className="border-2 border-black bg-white p-12 text-center">
            <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-bold text-lg text-gray-500">
              No attendance records
            </p>
            <p className="text-sm text-gray-400 mt-1">
              for {MONTHS[month - 1]} {year}
            </p>
          </div>
        ) : (
          <div className="bg-white border-2 border-black overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-[#F0F6FF]">
                  {["Date", "Status", "Check In", "Check Out", "Hours"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-600"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const hours =
                    r.checkIn && r.checkOut
                      ? (
                          (new Date(r.checkOut).getTime() -
                            new Date(r.checkIn).getTime()) /
                          3600000
                        ).toFixed(1) + "h"
                      : "—";
                  return (
                    <tr
                      key={r._id}
                      className={`border-b border-black/10 ${i % 2 === 0 ? "" : "bg-[#F8FAFF]"}`}
                    >
                      <td className="px-4 py-2.5 font-medium text-black">
                        {new Date(r.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          weekday: "short",
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {statusIcon(r.status)}
                          <span className="text-xs font-bold">
                            {statusLabel(r.status)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {fmt(r.checkIn)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {fmt(r.checkOut)}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-gray-700">
                        {hours}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
