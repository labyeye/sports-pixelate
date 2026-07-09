import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { attendanceAPI, employeeAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { AttendanceRecord, Employee } from "@/types/hrms";
import { cn } from "@/lib/utils";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Fingerprint,
  CreditCard,
  Scan,
  KeyRound,
  MousePointerClick,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Users,
  UserCheck,
  UserX,
  Timer,
  AlarmClock,
  LogOut,
  Palmtree,
  MapPin,
} from "lucide-react";

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// True if `dateStr` (YYYY-MM-DD) falls before the employee's join date or
// after their exit date — i.e. they weren't employed on that date.
function isOutsideEmploymentPeriod(dateStr: string, emp: any): boolean {
  if (emp.joinDate && dateStr < toLocalDateStr(emp.joinDate)) return true;
  if (emp.exitDate && dateStr > toLocalDateStr(emp.exitDate)) return true;
  return false;
}

function isWeekendForEmployee(dateStr: string, emp: any): boolean {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (emp.workScheduleType === "custom") {
    const working: number[] = emp.customWorkDays || [];
    return !working.includes(day);
  }
  const days = emp.workDaysPerWeek ?? 6;
  if (days === 5) return day === 0 || day === 6;
  if (days === 6) return day === 0;
  return false;
}

// Use LOCAL date so IST midnight stored as UTC doesn't shift the day
const toLocalDateStr = (isoStr: string) => {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const VERIFY_MODE_CONFIG: Record<
  string,
  { label: string; icon: any; color: string }
> = {
  fingerprint: {
    label: "Finger",
    icon: Fingerprint,
    color: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]",
  },
  card: {
    label: "Card",
    icon: CreditCard,
    color: "bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]",
  },
  face: {
    label: "Face",
    icon: Scan,
    color: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
  },
  geo_camera: {
    label: "Face",
    icon: Scan,
    color: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
  },
  password: {
    label: "Password",
    icon: KeyRound,
    color: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
  },
  manual: {
    label: "Manual",
    icon: MousePointerClick,
    color: "bg-gray-100 text-gray-500 border-gray-300",
  },
};

const STATUS_COLORS: Record<string, string> = {
  present: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C] px-2 py-0.5",
  absent: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444] px-2 py-0.5",
  half_day: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] px-2 py-0.5",
  late: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] px-2 py-0.5",
  on_leave: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB] px-2 py-0.5",
  holiday: "bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7] px-2 py-0.5",
  weekend: "bg-gray-100 text-gray-500 border-gray-300 px-2 py-0.5",
  not_checked_in: "bg-gray-100 text-gray-500 border-gray-300 px-2 py-0.5",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  present: CheckCircle,
  absent: XCircle,
  half_day: AlertCircle,
  late: Clock,
  on_leave: Calendar,
  not_checked_in: Clock,
};

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

export default function AttendancePage() {
  const { user } = useAuth();
  const isEmployee = user?.role === "employee";
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [markModal, setMarkModal] = useState(false);
  const [markForm, setMarkForm] = useState({
    employee: "",
    date: new Date().toISOString().split("T")[0],
    status: "present",
    checkIn: "",
    checkOut: "",
    overtime: "",
    notes: "",
    verifyMode: "manual",
  });
  const [saving, setSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [windowStart, setWindowStart] = useState<number>(1);
  const [markingAbsent, setMarkingAbsent] = useState(false);
  const [locationRecord, setLocationRecord] = useState<AttendanceRecord | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const attRes = await attendanceAPI.getAll({
        month: String(month),
        year: String(year),
        limit: "200",
      });
      if (attRes.success) setRecords(attRes.data);
      if (!isEmployee) {
        const empRes = await employeeAPI.getAll({
          status: "active",
          limit: "200",
        });
        if (empRes.success) setEmployees(empRes.data);
      }
    } catch {}
    setLoading(false);
  }, [month, year, isEmployee]);

  useEffect(() => {
    load();
  }, [load]);

  const toLocalInput = (iso: string | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Returns datetime-local string pre-filled with the given date.
  // Uses current time if the date is today, otherwise 09:00.
  const defaultCheckIn = (dateStr: string): string => {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const time =
      dateStr === today
        ? `${pad(now.getHours())}:${pad(now.getMinutes())}`
        : "09:00";
    return `${dateStr}T${time}`;
  };

  const markAbsentSingle = async (empId: string) => {
    try {
      await attendanceAPI.mark({
        employee: empId,
        date: selectedDate || new Date().toISOString().split("T")[0],
        status: "absent",
        verifyMode: "manual",
      });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openMarkForEmployee = (empId: string) => {
    const date = selectedDate || new Date().toISOString().split("T")[0];
    setMarkForm({
      employee: empId,
      date,
      status: "present",
      checkIn: defaultCheckIn(date),
      checkOut: "",
      overtime: "",
      notes: "",
      verifyMode: "manual",
    });
    setEditingId(null);
    setMarkModal(true);
  };

  const openEdit = (rec: AttendanceRecord) => {
    const emp = rec.employee as any;
    setMarkForm({
      employee: emp?._id ?? "",
      date: toLocalDateStr(rec.date),
      status: rec.status,
      checkIn: toLocalInput(rec.checkIn as any),
      checkOut: toLocalInput(rec.checkOut as any),
      overtime: (rec as any).overtime ? String((rec as any).overtime) : "",
      notes: (rec as any).notes ?? "",
      verifyMode: (rec as any).verifyMode ?? "manual",
    });
    setEditingId(rec._id);
    setMarkModal(true);
  };

  // "2024-06-10T09:00" from datetime-local has no timezone.
  // new Date() in the browser parses it as local (IST), so .toISOString() gives
  // the correct UTC equivalent before it's sent to the server.
  const localToISO = (s: string) => (s ? new Date(s).toISOString() : undefined);

  const handleMark = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        ...markForm,
        checkIn: localToISO(markForm.checkIn),
        checkOut: localToISO(markForm.checkOut),
      };
      // Only send overtime when user explicitly entered a value; omitting it lets
      // the backend auto-calculate OT from checkout time vs shift end.
      if (markForm.overtime !== "") {
        payload.overtime = parseFloat(markForm.overtime) || 0;
      } else {
        delete payload.overtime;
      }
      if (editingId) {
        await attendanceAPI.update(editingId, payload);
      } else {
        await attendanceAPI.mark(payload);
      }
      setMarkModal(false);
      setEditingId(null);
      load();
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  };

  const handleMarkAbsent = async (empIds: string[], date: string) => {
    setMarkingAbsent(true);
    try {
      await Promise.all(
        empIds.map((empId) =>
          attendanceAPI.mark({
            employee: empId,
            date,
            status: "absent",
            verifyMode: "manual",
          }),
        ),
      );
      load();
    } catch (err: any) {
      alert(err.message);
    }
    setMarkingAbsent(false);
  };

  const summary = {
    total: records.filter((r) => !["holiday", "weekend"].includes(r.status))
      .length,
    present: records.filter((r) => r.status === "present").length,
    absent: records.filter((r) => r.status === "absent").length,
    halfDay: records.filter((r) => r.status === "half_day").length,
    late: records.filter((r) => r.status === "late").length,
    earlyLeaving: records.filter((r) => {
      const rec = r as any;
      return rec.earlyLeaving || (r.status === "present" && rec.earlyCheckout);
    }).length,
    leave: records.filter((r) => r.status === "on_leave").length,
  };

  // days in selected month
  const daysInMonth = new Date(year, month, 0).getDate();

  // sync windowStart to show today's week when month changes
  useEffect(() => {
    const today = new Date();
    if (today.getFullYear() === year && today.getMonth() + 1 === month) {
      const d = today.getDate();
      setWindowStart(Math.max(1, d - 3));
    } else {
      setWindowStart(1);
    }
    setSelectedDate(null);
  }, [month, year]);

  // 7 days shown in the strip
  const stripDays = Array.from({ length: 7 }, (_, i) => {
    const day = windowStart + i;
    if (day > daysInMonth) return null;
    const date = new Date(year, month - 1, day);
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayRecords = records.filter((r) => toLocalDateStr(r.date) === iso);
    const presentCount = dayRecords.filter((r) =>
      ["present", "late", "half_day"].includes(r.status),
    ).length;
    const absentCount = dayRecords.filter((r) => r.status === "absent").length;
    return { day, date, iso, dayRecords, presentCount, absentCount };
  }).filter(Boolean) as {
    day: number;
    date: Date;
    iso: string;
    dayRecords: AttendanceRecord[];
    presentCount: number;
    absentCount: number;
  }[];

  const todayIso = new Date().toISOString().split("T")[0];

  const baseRecords = activeFilter
    ? activeFilter === "early_leaving"
      ? records.filter((r) => {
          const rec = r as any;
          return (
            rec.earlyLeaving || (r.status === "present" && rec.earlyCheckout)
          );
        })
      : records.filter((r) => r.status === activeFilter)
    : records;

  let displayedRecords: any[];
  if (selectedDate && !isEmployee && employees.length > 0) {
    const dateRecords = records.filter(
      (r) => toLocalDateStr(r.date) === selectedDate,
    );
    const recordByEmpId = new Map(
      dateRecords.map((r) => [(r.employee as any)?._id, r]),
    );
    displayedRecords = employees
      .filter((emp) => !isOutsideEmploymentPeriod(selectedDate, emp))
      .map((emp) => {
        const existing = recordByEmpId.get(emp._id);
        if (existing) return existing;
        const weekend = isWeekendForEmployee(selectedDate, emp);
        return {
          _id: `v_${emp._id}`,
          employee: emp,
          date: selectedDate,
          status: weekend ? "weekend" : "not_checked_in",
        };
      });
    if (activeFilter && activeFilter !== "early_leaving") {
      displayedRecords = displayedRecords.filter(
        (r) => r.status === activeFilter,
      );
    } else if (activeFilter === "early_leaving") {
      displayedRecords = displayedRecords.filter(
        (r) => (r as any).earlyLeaving,
      );
    }
  } else {
    displayedRecords = selectedDate
      ? baseRecords.filter((r) => toLocalDateStr(r.date) === selectedDate)
      : baseRecords;
  }

  return (
    <AppLayout title="Attendance">
      {/* Top bar: month/year + button */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="border-2 border-black px-3 py-2 text-xs font-bold bg-white hover:bg-gray-50 flex items-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" /> Clear date
            </button>
          )}
        </div>
        {!isEmployee && (
          <button
            onClick={() => {
              const date =
                selectedDate || new Date().toISOString().split("T")[0];
              setMarkForm((f) => ({
                ...f,
                date,
                checkIn: defaultCheckIn(date),
              }));
              setMarkModal(true);
            }}
            className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5"
          >
            <Clock className="w-4 h-4" /> Mark Attendance
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
        {[
          {
            label: "Total",
            value: summary.total,
            icon: Users,
            bg: "bg-[#024BAB]",
            text: "text-white",
            filterKey: "total",
          },
          {
            label: "Present",
            value: summary.present,
            icon: UserCheck,
            bg: "bg-[#00C48C]",
            text: "text-white",
            filterKey: "present",
          },
          {
            label: "Absent",
            value: summary.absent,
            icon: UserX,
            bg: "bg-[#EF4444]",
            text: "text-white",
            filterKey: "absent",
          },
          {
            label: "Half Day",
            value: summary.halfDay,
            icon: Timer,
            bg: "bg-[#F59E0B]",
            text: "text-white",
            filterKey: "half_day",
          },
          {
            label: "Late",
            value: summary.late,
            icon: AlarmClock,
            bg: "bg-[#A855F7]",
            text: "text-white",
            filterKey: "late",
          },
          {
            label: "Early Leave",
            value: summary.earlyLeaving,
            icon: LogOut,
            bg: "bg-[#3B82F6]",
            text: "text-white",
            filterKey: "early_leaving",
          },
          {
            label: "On Leave",
            value: summary.leave,
            icon: Palmtree,
            bg: "bg-[#EAB308]",
            text: "text-white",
            filterKey: "on_leave",
          },
        ].map(({ label, value, icon: Icon, bg, text, filterKey }) => {
          const isActive = activeFilter === filterKey;
          return (
            <button
              key={filterKey}
              onClick={() =>
                setActiveFilter(
                  isActive || filterKey === "total" ? null : filterKey,
                )
              }
              className={cn(
                "border-2 border-black p-4 flex flex-col gap-2 text-left transition-all",
                isActive
                  ? `${bg} ${text} shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]`
                  : "bg-white hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]",
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 border-2 border-black flex items-center justify-center shrink-0",
                  isActive ? "bg-white/20 border-white/40" : bg,
                )}
              >
                <Icon
                  className={cn("w-4 h-4", isActive ? text : "text-white")}
                />
              </div>
              <div>
                <p
                  className={cn(
                    "text-2xl font-bold leading-none",
                    isActive ? text : "text-black",
                  )}
                >
                  {value}
                </p>
                <p
                  className={cn(
                    "text-[11px] font-bold mt-1 uppercase tracking-wider",
                    isActive ? `${text} opacity-80` : "text-muted-foreground",
                  )}
                >
                  {label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Date strip */}
      <div className="border-2 border-black bg-white mb-5 flex items-stretch">
        {/* Left arrow */}
        <button
          onClick={() => setWindowStart((s) => Math.max(1, s - 7))}
          disabled={windowStart <= 1}
          className="px-3 border-r-2 border-black hover:bg-[#024BAB]/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Day cells */}
        <div className="flex flex-1 overflow-hidden">
          {stripDays.map(({ day, date, iso, presentCount, absentCount }) => {
            const isToday = iso === todayIso;
            const isSelected = iso === selectedDate;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <button
                key={iso}
                onClick={() =>
                  setSelectedDate(iso === selectedDate ? null : iso)
                }
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-3 px-1 border-r last:border-r-0 border-black/10 transition-colors relative",
                  isSelected
                    ? "bg-[#024BAB] text-white"
                    : isToday
                      ? "bg-[#024BAB]/5"
                      : isWeekend
                        ? "bg-gray-50"
                        : "hover:bg-[#024BAB]/5",
                )}
              >
                {/* Today indicator dot */}
                {isToday && !isSelected && (
                  <span className="absolute top-1.5 w-1.5 h-1.5 rounded-full bg-[#024BAB]" />
                )}

                {/* Day + Date on one line */}
                <span
                  className={cn(
                    "text-xs font-bold whitespace-nowrap mb-2",
                    isSelected
                      ? "text-white"
                      : isToday
                        ? "text-[#024BAB]"
                        : isWeekend
                          ? "text-gray-400"
                          : "text-black",
                  )}
                >
                  {DAY_ABBR[date.getDay()]},{" "}
                  {date.toLocaleDateString("en-IN", { month: "short" })} {day}
                </span>

                {/* Present / absent counts */}
                {presentCount > 0 || absentCount > 0 ? (
                  <div className="flex flex-col items-center gap-0.5">
                    {presentCount > 0 && (
                      <span
                        className={cn(
                          "text-[11px] font-bold leading-none",
                          isSelected ? "text-[#86efac]" : "text-[#00C48C]",
                        )}
                      >
                        {presentCount}P
                      </span>
                    )}
                    {absentCount > 0 && (
                      <span
                        className={cn(
                          "text-[11px] font-bold leading-none",
                          isSelected ? "text-[#fca5a5]" : "text-[#EF4444]",
                        )}
                      >
                        {absentCount}A
                      </span>
                    )}
                  </div>
                ) : (
                  <span
                    className={cn(
                      "text-[10px]",
                      isSelected ? "text-white/40" : "text-muted-foreground/40",
                    )}
                  >
                    —
                  </span>
                )}

                {/* Selected underline */}
                {isSelected && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right arrow */}
        <button
          onClick={() =>
            setWindowStart((s) => Math.min(daysInMonth - 6, s + 7))
          }
          disabled={windowStart + 7 > daysInMonth}
          className="px-3 border-l-2 border-black hover:bg-[#024BAB]/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Auto-absent banner */}
      {!isEmployee &&
        selectedDate &&
        selectedDate <= todayIso &&
        employees.length > 0 &&
        (() => {
          const recordedEmpIds = new Set(
            displayedRecords
              .filter(
                (r) => r.status !== "not_checked_in" && r.status !== "weekend",
              )
              .map((r) => (r.employee as any)?._id),
          );
          const unrecorded = employees.filter(
            (e) =>
              !recordedEmpIds.has(e._id) &&
              !isWeekendForEmployee(selectedDate, e) &&
              !isOutsideEmploymentPeriod(selectedDate, e),
          );
          if (unrecorded.length === 0) return null;
          return (
            <div className="mb-4 border-2 border-[#EF4444] bg-[#EF4444]/5 px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4 text-[#EF4444] shrink-0" />
                <p className="text-sm font-bold text-[#EF4444]">
                  {unrecorded.length} employee{unrecorded.length > 1 ? "s" : ""}{" "}
                  have no record for this date
                </p>
              </div>
              <button
                onClick={() =>
                  handleMarkAbsent(
                    unrecorded.map((e) => e._id),
                    selectedDate,
                  )
                }
                disabled={markingAbsent}
                className="border-2 border-[#EF4444] bg-[#EF4444] text-white text-xs font-bold px-3 py-1.5 hover:bg-[#dc2626] disabled:opacity-50 shrink-0"
              >
                {markingAbsent ? "Saving…" : "Mark All Absent"}
              </button>
            </div>
          );
        })()}

      {}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : displayedRecords.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <Clock className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No attendance records</p>
          <p className="text-sm text-muted-foreground mt-1">
            for {MONTHS[month - 1]} {year}
          </p>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "Employee",
                  "Date",
                  "Check In",
                  "Check Out",
                  "Hours",
                  "OT Hrs",
                  "Via",
                  "Status",
                  "Location",
                  ...(isEmployee ? [] : [""]),
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedRecords.map((rec, i) => {
                const Icon = STATUS_ICONS[rec.status] || Clock;
                return (
                  <tr
                    key={rec._id}
                    className={cn(
                      "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                      i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {(rec.employee as any)?.avatar ? (
                          <img
                            src={(rec.employee as any).avatar}
                            alt={(rec.employee as any)?.firstName}
                            className="w-7 h-7 border-2 border-black object-cover shrink-0 rounded-full"
                          />
                        ) : (
                          <div className="w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[10px] font-bold text-white shrink-0 rounded-full">
                            {(
                              rec.employee as any
                            )?.firstName?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="font-bold text-black text-xs">
                          {(rec.employee as any)?.firstName}{" "}
                          {(rec.employee as any)?.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-black text-xs">
                      {new Date(rec.date).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-black text-xs">
                      {rec.checkIn
                        ? new Date(rec.checkIn).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-black text-xs">
                      {rec.checkOut
                        ? new Date(rec.checkOut).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-black text-xs">
                      {rec.workHours ? `${rec.workHours.toFixed(1)}h` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {(rec as any).overtime > 0 ? (
                        <span className="font-bold text-[#FA731C]">
                          {(rec as any).overtime.toFixed(1)}h
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const mode = (rec as any).verifyMode || "manual";
                        const cfg =
                          VERIFY_MODE_CONFIG[mode] || VERIFY_MODE_CONFIG.manual;
                        const ModeIcon = cfg.icon;
                        return (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border-2",
                              cfg.color,
                            )}
                          >
                            <ModeIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={cn(
                            "border-2 text-[10px] capitalize flex items-center gap-1 w-fit",
                            STATUS_COLORS[rec.status],
                          )}
                        >
                          <Icon className="w-3 h-3" />{" "}
                          {rec.status === "weekend"
                            ? new Date(
                                rec.date + "T00:00:00",
                              ).toLocaleDateString("en-IN", {
                                weekday: "long",
                              })
                            : rec.status.replace("_", " ")}
                        </span>
                        {(rec as any).earlyLeaving && (
                          <span className="border-2 text-[10px] flex items-center gap-1 w-fit bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6] px-2 py-0.5">
                            <LogOut className="w-3 h-3" /> Early Leave
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {rec.checkInLocation || rec.checkOutLocation ? (
                        <button
                          onClick={() => setLocationRecord(rec)}
                          title="View check-in/check-out location"
                          className="p-1.5 border-2 border-black hover:bg-[#024BAB] hover:text-white transition-colors"
                        >
                          <MapPin className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    {!isEmployee && (
                      <td className="px-4 py-3">
                        {rec._id.startsWith("v_") ? (
                          rec.status === "weekend" ? null : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  markAbsentSingle((rec.employee as any)?._id)
                                }
                                title="Mark absent"
                                className="p-1.5 border-2 border-[#EF4444] bg-[#EF4444] text-white hover:bg-[#dc2626] transition-colors"
                              >
                                <XCircle className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() =>
                                  openMarkForEmployee(
                                    (rec.employee as any)?._id,
                                  )
                                }
                                title="Mark attendance"
                                className="p-1.5 border-2 border-[#024BAB] bg-[#024BAB] text-white hover:bg-[#0136a0] transition-colors"
                              >
                                <Clock className="w-3 h-3" />
                              </button>
                            </div>
                          )
                        ) : (
                          <button
                            onClick={() => openEdit(rec)}
                            title="Edit attendance"
                            className="p-1.5 border-2 border-black hover:bg-[#024BAB] hover:text-white transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {}
      {markModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">
                {editingId ? "Edit Attendance" : "Mark Attendance"}
              </h3>
              <button
                onClick={() => {
                  setMarkModal(false);
                  setEditingId(null);
                }}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleMark} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Employee
                </label>
                <select
                  value={markForm.employee}
                  onChange={(e) =>
                    setMarkForm({ ...markForm, employee: e.target.value })
                  }
                  className="border-2 w-full px-3 py-2 text-sm disabled:opacity-60 disabled:bg-gray-50"
                  required
                  disabled={!!editingId}
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.firstName} {e.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={markForm.date}
                  onChange={(e) => {
                    const d = e.target.value;
                    setMarkForm((f) => ({
                      ...f,
                      date: d,
                      checkIn: f.checkIn ? defaultCheckIn(d) : "",
                    }));
                  }}
                  className="border-2 w-full px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Status
                </label>
                <select
                  value={markForm.status}
                  onChange={(e) =>
                    setMarkForm({ ...markForm, status: e.target.value })
                  }
                  className="border-2 w-full px-3 py-2 text-sm"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="half_day">Half Day</option>
                  <option value="late">Late</option>
                  <option value="on_leave">On Leave</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Check In
                  </label>
                  <input
                    type="datetime-local"
                    value={markForm.checkIn}
                    onChange={(e) =>
                      setMarkForm({ ...markForm, checkIn: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Check Out
                  </label>
                  <input
                    type="datetime-local"
                    value={markForm.checkOut}
                    onChange={(e) =>
                      setMarkForm({ ...markForm, checkOut: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Overtime Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g. 1.5"
                    value={markForm.overtime}
                    onChange={(e) =>
                      setMarkForm({ ...markForm, overtime: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Via (Verify Mode)
                  </label>
                  <select
                    value={markForm.verifyMode}
                    onChange={(e) =>
                      setMarkForm({ ...markForm, verifyMode: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  >
                    <option value="manual">Manual</option>
                    <option value="fingerprint">Fingerprint</option>
                    <option value="face">Face</option>
                    <option value="card">Card</option>
                    <option value="password">Password</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Attendance"
                      : "Mark Attendance"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMarkModal(false);
                    setEditingId(null);
                  }}
                  className="border-2 bg-white text-black px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {locationRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#024BAB]" />
                Attendance Location
              </h3>
              <button onClick={() => setLocationRecord(null)}>
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground -mt-1">
                {(locationRecord.employee as any)?.firstName}{" "}
                {(locationRecord.employee as any)?.lastName} —{" "}
                {new Date(locationRecord.date).toLocaleDateString("en-IN")}
              </p>
              {[
                { label: "Check In", loc: locationRecord.checkInLocation },
                { label: "Check Out", loc: locationRecord.checkOutLocation },
              ].map(({ label, loc }) =>
                loc ? (
                  <div key={label} className="border-2 border-black/10 p-3">
                    <p className="text-xs font-bold text-black mb-1">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      Lat {loc.lat.toFixed(6)}, Lng {loc.lng.toFixed(6)}
                    </p>
                    {loc.distanceMeters != null && (
                      <p className="text-xs text-muted-foreground">
                        {Math.round(loc.distanceMeters)}m from allowed geofence
                      </p>
                    )}
                    {loc.accuracy != null && (
                      <p className="text-xs text-muted-foreground">
                        GPS accuracy: ±{Math.round(loc.accuracy)}m
                      </p>
                    )}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs font-bold text-[#024BAB] underline"
                    >
                      Open in Google Maps
                    </a>
                  </div>
                ) : (
                  <div key={label} className="border-2 border-black/10 p-3">
                    <p className="text-xs font-bold text-black mb-1">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      No location recorded
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
