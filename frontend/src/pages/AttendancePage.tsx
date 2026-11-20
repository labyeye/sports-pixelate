import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { AnimatedValue } from "@/components/ui/AnimatedValue";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  attendanceAPI,
  employeeAPI,
  attendanceSettingsAPI,
} from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { StatCard } from "@/components/ui/StatCard";
import { ViewTabs, useViewTab } from "@/components/ui/ViewTabs";
import { ChartCard, NbTooltip } from "@/components/ui/ChartCard";
import { preferencesAPI } from "@/services/api";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import {
  BarChart,
  Bar,
  LabelList,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { AttendanceRecord, Employee } from "@/types/hrms";
import { cn } from "@/lib/utils";
import { EmployeeCombobox } from "@/components/employees/EmployeeCombobox";
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
  ChevronDown,
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
  ScanFace,
  Search,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import FaceKioskModal from "@/components/attendance/FaceKioskModal";

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
  const [expandedRec, setExpandedRec] = useState<string | null>(null);
  const { user } = useAuth();
  const [view, setView] = useViewTab("attendance");
  const { toast } = useToast();
  const confirm = useConfirm();
  const isEmployee = user?.role === "employee";
  const isAdmin = user?.role === "super_admin" || user?.role === "hr_manager";
  const [kioskOpen, setKioskOpen] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  // status counts per calendar day of the month (one aggregation) - feeds the date strip without loading every row
  const [daily, setDaily] = useState<Record<string, Record<string, number>>>(
    {},
  );
  const reqId = useRef(0);
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
  // Each person can pick which status they land on first (kept per user, per browser).
  const defaultKey = `nesthr:attendance:default-status:${(user as any)?._id ?? (user as any)?.id ?? "me"}`;
  const readDefault = () => {
    try {
      return localStorage.getItem(defaultKey) || null;
    } catch {
      return null;
    }
  };
  const [defaultStatus, setDefaultStatus] = useState<string | null>(
    readDefault,
  );
  const [activeFilter, setActiveFilter] = useState<string | null>(
    defaultStatus,
  );
  const saveDefault = (v: string | null) => {
    try {
      if (v) localStorage.setItem(defaultKey, v);
      else localStorage.removeItem(defaultKey);
    } catch {
      /* storage blocked */
    }
    setDefaultStatus(v);
  };
  // Details-tab toolbar: search + department filter + sort
  const [search, setSearch] = useState("");
  // This admin's saved view (filter + sort), stored in the database so it follows them to any device.
  useEffect(() => {
    if (isEmployee) return;
    preferencesAPI
      .get("attendance.view")
      .then((r: any) => {
        const v = r?.data;
        if (!v || typeof v !== "object") return;
        if (typeof v.status === "string") setActiveFilter(v.status || null);
        if (typeof v.dept === "string") setDeptFilter(v.dept);
        if (
          ["name", "checkIn", "checkOut", "workHours", "status"].includes(
            v.sortKey,
          )
        )
          setSortKey(v.sortKey);
        if (v.sortDir === "asc" || v.sortDir === "desc") setSortDir(v.sortDir);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmployee]);
  const saveMyView = async () => {
    try {
      await preferencesAPI.set(
        "attendance.view",
        {
          status: activeFilter || "",
          dept: deptFilter,
          sortKey,
          sortDir,
        },
        true,
      );
      toast({
        title: "View saved",
        description: "This filter and sort will open by default for you.",
      });
    } catch (e: any) {
      toast({
        title: "Could not save",
        description: e.message,
        variant: "destructive",
      });
    }
  };
  // Bulk edit: employees ticked in the table + what to apply to them (all optional, at least one needed)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState({ status: "", checkIn: "", checkOut: "" });
  const [bulkSaving, setBulkSaving] = useState(false);
  const [deptFilter, setDeptFilter] = useState("");
  // Default view: whoever checked in first is on top; people with no check-in yet go to the bottom.
  const [sortKey, setSortKey] = useState<
    "name" | "checkIn" | "checkOut" | "workHours" | "status"
  >("checkIn");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [stripCount, setStripCount] = useState(7);
  const stripRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const fit = () =>
      setStripCount(
        Math.min(31, Math.max(3, Math.floor(el.clientWidth / 120))),
      );
    fit();
    new ResizeObserver(fit).observe(el); // dies with the element
  }, []);
  const [windowStart, setWindowStart] = useState<number>(1);
  const [markingAbsent, setMarkingAbsent] = useState(false);
  const [locationRecord, setLocationRecord] = useState<AttendanceRecord | null>(
    null,
  );
  const [myLateBalance, setMyLateBalance] = useState<{
    lateUsed: number;
    lateAllowed: number;
  } | null>(null);

  // HR/admin screens load ONE day at a time (2,000 staff x 26 days would be 50k rows); employees load their own month.
  const todayStr = new Date().toISOString().split("T")[0];
  const load = useCallback(async () => {
    const my = ++reqId.current;
    setLoading(true);
    try {
      const attRes = await attendanceAPI.getAll(
        isEmployee
          ? { month: String(month), year: String(year), limit: "5000" }
          : { date: selectedDate || todayStr, limit: "5000" },
      );
      if (my !== reqId.current) return; // a newer request superseded this one
      if (attRes.success) setRecords(attRes.data);
      if (!isEmployee) {
        const [dailyRes, empRes] = await Promise.all([
          attendanceAPI
            .getDailySummary({ month: String(month), year: String(year) })
            .catch(() => null),
          employees.length
            ? Promise.resolve(null)
            : employeeAPI.getAll({ status: "active", limit: "5000" }),
        ]);
        if (dailyRes?.success) setDaily(dailyRes.data);
        if (empRes?.success) setEmployees(empRes.data);
      } else {
        attendanceSettingsAPI
          .getMyBalance()
          .then((r) => {
            if (r.success)
              setMyLateBalance({
                lateUsed: r.data.lateUsed,
                lateAllowed: r.data.lateAllowed,
              });
          })
          .catch(() => {});
      }
    } catch {}
    if (my === reqId.current) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, isEmployee, selectedDate]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedDate]);

  // Timing insights (month-wide) for the Graphs tab: admin/HR only.
  type Insights = {
    hourly: { startMin: number; count: number }[];
    weekday: { dow: number; avg: number }[];
    employees: {
      id: string;
      name: string;
      avgMins: number;
      days: number;
      late: number;
      avgHours: number;
    }[];
  };
  const [insights, setInsights] = useState<Insights | null>(null);
  useEffect(() => {
    if (isEmployee || view !== "graphs") return;
    let cancelled = false;
    attendanceAPI
      .getTimingInsights({ month: String(month), year: String(year) })
      .then((r: any) => {
        if (!cancelled && r?.success) setInsights(r.data);
      })
      .catch(() => {
        if (!cancelled) setInsights(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isEmployee, view, month, year]);

  const fmtMins = (m: number) => {
    const h24 = Math.floor(m / 60) % 24;
    const mm = String(m % 60).padStart(2, "0");
    const h12 = h24 % 12 || 12;
    return `${h12}:${mm} ${h24 < 12 ? "AM" : "PM"}`;
  };
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hourlyChart = (insights?.hourly || []).map((h) => ({
    label: fmtMins(h.startMin),
    count: h.count,
  }));
  const peakHour = hourlyChart.length
    ? hourlyChart.reduce((a, b) => (b.count > a.count ? b : a))
    : null;
  const quietHour =
    hourlyChart.length > 1
      ? hourlyChart.reduce((a, b) => (b.count < a.count ? b : a))
      : null;
  const weekdayChart = (insights?.weekday || []).map((w) => ({
    label: WEEKDAYS[w.dow - 1],
    avg: w.avg,
  }));
  const timingEmps = insights?.employees || [];
  const earlyBirds = timingEmps.slice(0, 5);
  const lateComers =
    timingEmps.length > 5 ? timingEmps.slice(-5).reverse() : [];

  // Check-in/out are edited as time-of-day only ("HH:MM"); the date always comes from the record's own date.
  const toLocalInput = (iso: string | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Default check-in time ("HH:MM"): the current time if the date is today, otherwise the employee's shift start.
  const defaultCheckIn = (dateStr: string, empId?: string): string => {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return dateStr === today
      ? `${pad(now.getHours())}:${pad(now.getMinutes())}`
      : shiftTimesFor(empId).start;
  };

  // Employee's shift start/end ("HH:MM"), falling back to 09:00-18:00 if unset.
  const shiftTimesFor = (empId?: string): { start: string; end: string } => {
    const emp = employees.find((e) => e._id === empId) as any;
    const start =
      emp?.customShift?.startTime || emp?.shift?.startTime || "09:00";
    const end = emp?.customShift?.endTime || emp?.shift?.endTime || "18:00";
    return { start, end };
  };

  const defaultCheckOut = (_dateStr: string, empId?: string): string =>
    shiftTimesFor(empId).end;

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
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const openMarkForEmployee = (empId: string) => {
    const date = selectedDate || new Date().toISOString().split("T")[0];
    setMarkForm({
      employee: empId,
      date,
      status: "present",
      checkIn: defaultCheckIn(date, empId),
      checkOut: defaultCheckOut(date, empId),
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

  // Put a time ("HH:MM") on the record's date. A check-out earlier than the check-in is the next morning (night shift).
  const timeOnDate = (date: string, time: string, notBefore?: string) => {
    if (!time) return undefined;
    let t = new Date(`${date}T${time}`);
    if (notBefore && t <= new Date(notBefore))
      t = new Date(t.getTime() + 86400000);
    return t.toISOString();
  };

  const handleMark = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await confirm({
      title: editingId ? "Update attendance record?" : "Mark attendance?",
      description: editingId
        ? "This will overwrite the existing record for this employee and date."
        : "This will create a new attendance record for this employee.",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const inISO = timeOnDate(markForm.date, markForm.checkIn);
      const payload: Record<string, any> = {
        ...markForm,
        checkIn: inISO,
        checkOut: timeOnDate(markForm.date, markForm.checkOut, inISO),
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
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const handleMarkAbsent = async (empIds: string[], date: string) => {
    setMarkingAbsent(true);
    try {
      for (let i = 0; i < empIds.length; i += 500) {
        await attendanceAPI.bulkMark({
          date,
          records: empIds
            .slice(i, i + 500)
            .map((employee) => ({ employee, status: "absent" })),
        });
      }
      load();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
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

  // Graph-tab data: per-day counts (up to today for the current month) and the month's status split.
  const lastChartDay =
    year === now.getFullYear() && month === now.getMonth() + 1
      ? now.getDate()
      : daysInMonth;
  // Working days only: days with no present/late/half/absent rows (weekends, holidays) are skipped so the line doesn't flatline.
  const dailyChart = Array.from({ length: lastChartDay }, (_, i) => {
    const day = i + 1;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dc = daily[iso] || {};
    return {
      label: String(day),
      Present: (dc.present || 0) + (dc.late || 0) + (dc.half_day || 0),
      Late: dc.late || 0,
      "Half day": dc.half_day || 0,
      "On leave": dc.on_leave || 0,
      Absent: dc.absent || 0,
    };
  }).filter((d) => d.Present || d.Absent || d["On leave"]);
  const attendancePct = summary.total
    ? Math.round(
        ((summary.present + summary.late + summary.halfDay * 0.5) /
          summary.total) *
          100,
      )
    : 0;
  const heroDate = new Date(
    `${selectedDate || new Date().toISOString().split("T")[0]}T00:00:00`,
  );
  const isTodayHero =
    !selectedDate || selectedDate === new Date().toISOString().split("T")[0];
  const heroLabel = isEmployee
    ? `${MONTHS[month - 1]} ${year}`
    : `${isTodayHero ? "Today" : "On"} · ${heroDate.toLocaleDateString(
        "en-IN",
        {
          weekday: "short",
          day: "numeric",
          month: "short",
        },
      )}`;
  const statusSplit = [
    { name: "Present", value: summary.present, color: "#00C48C" },
    { name: "Late", value: summary.late, color: "#FACC15" },
    { name: "Half day", value: summary.halfDay, color: "#F59E0B" },
    { name: "Absent", value: summary.absent, color: "#EF4444" },
    { name: "On leave", value: summary.leave, color: "#3B82F6" },
  ].filter((s) => s.value > 0);

  // sync windowStart to show today's week when month changes
  useEffect(() => {
    const today = new Date();
    if (today.getFullYear() === year && today.getMonth() + 1 === month) {
      const d = today.getDate();
      setWindowStart(Math.max(1, d - 3));
    } else {
      setWindowStart(1);
    }
    if (isEmployee) setSelectedDate(null);
    else {
      const t = new Date();
      setSelectedDate(
        t.getFullYear() === year && t.getMonth() + 1 === month
          ? todayStr
          : `${year}-${String(month).padStart(2, "0")}-01`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  // As many days as fit the strip's width (~120px each)
  const stripDays = Array.from({ length: stripCount }, (_, i) => {
    const day = windowStart + i;
    if (day > daysInMonth) return null;
    const date = new Date(year, month - 1, day);
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayRecords = records.filter((r) => toLocalDateStr(r.date) === iso);
    const dc = daily[iso] || {};
    const presentCount =
      (dc.present || 0) + (dc.late || 0) + (dc.half_day || 0);
    const absentCount = dc.absent || 0;
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

  // Search / department / sort on top of the status filter above.
  const deptNames = Array.from(
    new Set(
      employees
        .map((e) => (e.department as any)?.name as string | undefined)
        .filter(Boolean) as string[],
    ),
  ).sort();
  const q = search.trim().toLowerCase();
  if (q) {
    displayedRecords = displayedRecords.filter((r) => {
      const e = r.employee as any;
      return (
        `${e?.firstName || ""} ${e?.lastName || ""}`
          .toLowerCase()
          .includes(q) ||
        String(e?.employeeId || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }
  if (deptFilter) {
    displayedRecords = displayedRecords.filter(
      (r) => (r.employee as any)?.department?.name === deptFilter,
    );
  }
  {
    const dir = sortDir === "asc" ? 1 : -1;
    const time = (v: any) => (v ? new Date(v).getTime() : null);
    const cmpNullable = (a: number | null, b: number | null) =>
      // rows without a value always sink to the bottom, whatever the direction
      a == null && b == null
        ? 0
        : a == null
          ? 1
          : b == null
            ? -1
            : (a - b) * dir;
    displayedRecords = [...displayedRecords].sort((a, b) => {
      const ea = a.employee as any;
      const eb = b.employee as any;
      switch (sortKey) {
        case "checkIn":
          return cmpNullable(time(a.checkIn), time(b.checkIn));
        case "checkOut":
          return cmpNullable(time(a.checkOut), time(b.checkOut));
        case "workHours":
          return cmpNullable(
            a.workHours ? Number(a.workHours) : null,
            b.workHours ? Number(b.workHours) : null,
          );
        case "status":
          return String(a.status).localeCompare(String(b.status)) * dir;
        default:
          return (
            `${ea?.firstName || ""} ${ea?.lastName || ""}`.localeCompare(
              `${eb?.firstName || ""} ${eb?.lastName || ""}`,
            ) * dir
          );
      }
    });
  }
  const filtersActive = !!(activeFilter || q || deptFilter);

  // ── Bulk edit (admin/HR): applies to the day shown in the table ──
  const bulkDate = selectedDate || todayStr;
  const rowEmpId = (r: any) => (r.employee as any)?._id as string | undefined;
  const visibleEmpIds = displayedRecords
    .map(rowEmpId)
    .filter(Boolean) as string[];
  const allVisibleSelected =
    visibleEmpIds.length > 0 &&
    visibleEmpIds.every((id) => selectedIds.has(id));
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAllVisible = () =>
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleEmpIds));
  const applyBulk = async () => {
    if (!bulk.status && !bulk.checkIn && !bulk.checkOut) {
      toast({
        title: "Nothing to apply",
        description: "Pick a status and/or a check-in / check-out time.",
        variant: "destructive",
      });
      return;
    }
    const ids = [...selectedIds];
    const dateLabel = new Date(`${bulkDate}T00:00:00`).toLocaleDateString(
      "en-IN",
      {
        weekday: "short",
        day: "numeric",
        month: "short",
      },
    );
    const ok = await confirm({
      title: `Update ${ids.length} attendance record${ids.length === 1 ? "" : "s"}?`,
      description: `For ${dateLabel}: ${[
        bulk.status ? `status → ${bulk.status.replace("_", " ")}` : "",
        bulk.checkIn ? `check-in ${bulk.checkIn}` : "",
        bulk.checkOut ? `check-out ${bulk.checkOut}` : "",
      ]
        .filter(Boolean)
        .join(", ")}. Existing values for these employees will be overwritten.`,
    });
    if (!ok) return;
    setBulkSaving(true);
    try {
      let updated = 0;
      let skipped = 0;
      for (let i = 0; i < ids.length; i += 500) {
        const res: any = await attendanceAPI.bulkUpdate({
          date: bulkDate,
          employees: ids.slice(i, i + 500),
          status: bulk.status || undefined,
          checkIn: bulk.checkIn || undefined,
          checkOut: bulk.checkOut || undefined,
        });
        updated += res?.updated ?? 0;
        skipped += res?.skipped?.length ?? 0;
      }
      toast({
        title: "Attendance updated",
        description: `${updated} updated${skipped ? `, ${skipped} skipped` : ""}.`,
      });
      setSelectedIds(new Set());
      setBulk({ status: "", checkIn: "", checkOut: "" });
      load();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
    setBulkSaving(false);
  };

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
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            name={`attendance_${year}_${String(month).padStart(2, "0")}`}
            rows={displayedRecords}
            cols={[
              { header: "Emp Code", value: (r: any) => r.employee?.employeeId },
              {
                header: "Employee",
                value: (r: any) =>
                  `${r.employee?.firstName || ""} ${r.employee?.lastName || ""}`.trim(),
              },
              { header: "Date", value: (r: any) => toLocalDateStr(r.date) },
              {
                header: "Check In",
                value: (r: any) =>
                  r.checkIn
                    ? new Date(r.checkIn).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "",
              },
              {
                header: "Check Out",
                value: (r: any) =>
                  r.checkOut
                    ? new Date(r.checkOut).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "",
              },
              {
                header: "Hours",
                value: (r: any) =>
                  r.workHours ? Number(r.workHours).toFixed(1) : "",
              },
              {
                header: "OT Hrs",
                value: (r: any) =>
                  r.overtime ? Number(r.overtime).toFixed(1) : "",
              },
              {
                header: "Status",
                value: (r: any) => String(r.status || "").replace(/_/g, " "),
              },
            ]}
          />
          {isAdmin && (
            <button
              onClick={() => setKioskOpen(true)}
              className="border-2 bg-white text-[#024BAB] px-4 py-2 text-sm flex items-center gap-1.5"
            >
              <ScanFace className="w-4 h-4" /> Face Attendance
            </button>
          )}
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
      </div>

      {isEmployee && myLateBalance && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-5">
          <div className="border-2 border-black bg-white p-4">
            <p className="text-xs font-bold uppercase text-muted-foreground">
              Late allowance left
            </p>
            <p className="text-2xl font-bold mt-1 text-[#024BAB]">
              <AnimatedValue
                value={Math.max(
                  myLateBalance.lateAllowed - myLateBalance.lateUsed,
                  0,
                )}
              />
              /{myLateBalance.lateAllowed}
            </p>
          </div>
        </div>
      )}

      <ViewTabs value={view} onChange={setView} className="mb-4" />

      {view === "graphs" && (
        <>
          {/* Hero: the one thing that matters — who is in, right now */}
          <div className="nb-rise border-2 border-black bg-white p-5 mb-3 flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-36 h-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={
                      statusSplit.length
                        ? statusSplit
                        : [{ name: "No data", value: 1, color: "#E5E7EB" }]
                    }
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={68}
                    startAngle={90}
                    endAngle={-270}
                    stroke="#0A0A0A"
                    strokeWidth={1.5}
                    animationDuration={1000}
                  >
                    {(statusSplit.length
                      ? statusSplit
                      : [{ name: "No data", value: 1, color: "#E5E7EB" }]
                    ).map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <AnimatedNumber
                  value={attendancePct}
                  suffix="%"
                  className="text-3xl font-bold tabular-nums text-[#024BAB] leading-none"
                />
                <span className="text-[10px] font-bold mt-1">attendance</span>
              </div>
            </div>
            <div className="flex-1 w-full">
              <p className="text-sm font-bold text-black mb-4">
                {heroLabel}
                <span className="text-muted-foreground font-medium">
                  {" "}
                  · {summary.total} marked
                </span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  {
                    label: "Present",
                    n: summary.present,
                    color: "#00C48C",
                    key: "present",
                  },
                  {
                    label: "Late",
                    n: summary.late,
                    color: "#CA8A04",
                    key: "late",
                  },
                  {
                    label: "Half day",
                    n: summary.halfDay,
                    color: "#F59E0B",
                    key: "half_day",
                  },
                  {
                    label: "Absent",
                    n: summary.absent,
                    color: "#EF4444",
                    key: "absent",
                  },
                  {
                    label: "On leave",
                    n: summary.leave,
                    color: "#3B82F6",
                    key: "on_leave",
                  },
                ].map((k) => (
                  <button
                    key={k.key}
                    onClick={() => {
                      setActiveFilter(k.key);
                      setView("details");
                    }}
                    className="text-left border-l-4 pl-3 hover:opacity-70 transition-opacity"
                    style={{ borderColor: k.color }}
                  >
                    <AnimatedNumber
                      value={k.n}
                      className="block text-3xl sm:text-4xl font-bold tabular-nums leading-none"
                    />
                    <span className="block text-xs font-bold text-black mt-1.5">
                      {k.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ChartCard
            className="mb-5"
            title="Month trend"
            subtitle="People present vs absent on each working day (weekends & holidays skipped)"
            empty={dailyChart.length ? undefined : "No attendance data yet"}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={dailyChart}
                margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E5E7EB"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fontWeight: 700, fill: "#0A0A0A" }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  allowDecimals={false}
                  domain={[
                    0,
                    (max: number) => Math.max(4, Math.ceil(max * 1.15)),
                  ]}
                />
                <Tooltip content={<NbTooltip />} />
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, fontWeight: 700 }}
                />
                {[
                  { key: "Present", color: "#00C48C", begin: 0 },
                  { key: "Late", color: "#CA8A04", begin: 125 },
                  { key: "Half day", color: "#F59E0B", begin: 190 },
                  { key: "On leave", color: "#3B82F6", begin: 220 },
                  { key: "Absent", color: "#EF4444", begin: 250 },
                ].map(({ key, color, begin }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={3}
                    dot={{
                      r: 3,
                      fill: color,
                      stroke: "#0A0A0A",
                      strokeWidth: 1.5,
                    }}
                    activeDot={{ r: 6, stroke: "#0A0A0A", strokeWidth: 1.5 }}
                    animationDuration={1100}
                    animationBegin={begin}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {!isEmployee && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-5">
                <ChartCard
                  className="lg:col-span-3"
                  title="Check-in time"
                  subtitle={
                    peakHour
                      ? `Most people arrive around ${peakHour.label} (${peakHour.count}).${
                          quietHour && quietHour.label !== peakHour.label
                            ? ` Fewest around ${quietHour.label} (${quietHour.count}).`
                            : ""
                        }`
                      : "How many check-ins happen in each 30 minutes"
                  }
                  empty={
                    hourlyChart.length ? undefined : "No check-in times yet"
                  }
                >
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={hourlyChart}
                      margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#E5E7EB"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fontWeight: 700 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{
                          fontSize: 11,
                          fontWeight: 700,
                          fill: "#0A0A0A",
                        }}
                        tickLine={false}
                        axisLine={false}
                        width={32}
                        allowDecimals={false}
                      />
                      <Tooltip
                        content={<NbTooltip />}
                        cursor={{ fill: "#024BAB11" }}
                      />
                      <Bar
                        dataKey="count"
                        name="Check-ins"
                        stroke="#0A0A0A"
                        strokeWidth={1.5}
                        radius={[6, 6, 0, 0]}
                        animationDuration={900}
                      >
                        {hourlyChart.map((h) => (
                          <Cell
                            key={h.label}
                            fill={
                              h.label === peakHour?.label
                                ? "#00C48C"
                                : "#024BAB"
                            }
                          />
                        ))}
                        <LabelList
                          dataKey="count"
                          position="top"
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            fill: "#0A0A0A",
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  className="lg:col-span-2"
                  title="Busiest days"
                  subtitle="Average people present on each weekday"
                  empty={weekdayChart.length ? undefined : "No data yet"}
                >
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={weekdayChart}
                      margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#E5E7EB"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fontWeight: 700 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{
                          fontSize: 11,
                          fontWeight: 700,
                          fill: "#0A0A0A",
                        }}
                        tickLine={false}
                        axisLine={false}
                        width={32}
                        allowDecimals={false}
                      />
                      <Tooltip
                        content={<NbTooltip />}
                        cursor={{ fill: "#A855F711" }}
                      />
                      <Bar
                        dataKey="avg"
                        name="Avg present"
                        fill="#A855F7"
                        stroke="#0A0A0A"
                        strokeWidth={1.5}
                        radius={[6, 6, 0, 0]}
                        animationDuration={900}
                      >
                        <LabelList
                          dataKey="avg"
                          position="top"
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            fill: "#0A0A0A",
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <ChartCard
                className="mb-5"
                title="Employee-wise timing"
                subtitle="Average check-in time this month (employees with 2+ days)"
                empty={
                  timingEmps.length ? undefined : "Not enough check-in data yet"
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[
                    {
                      title: "Usually first in",
                      rows: earlyBirds,
                      color: "#00C48C",
                    },
                    {
                      title: "Usually last in",
                      rows: lateComers,
                      color: "#EF4444",
                    },
                  ].map((g) => (
                    <div key={g.title}>
                      <p className="text-xs font-bold text-black mb-2">
                        {g.title}
                      </p>
                      {g.rows.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Not enough employees to compare yet
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {g.rows.map((r) => (
                            <li
                              key={r.id}
                              className="flex items-center gap-2 border-2 border-black px-3 py-1.5"
                            >
                              <span
                                className="w-2.5 h-2.5 border border-black shrink-0"
                                style={{ background: g.color }}
                              />
                              <span className="flex-1 text-sm font-bold truncate">
                                {r.name}
                              </span>
                              <span className="text-sm font-bold tabular-nums">
                                {fmtMins(r.avgMins)}
                              </span>
                              <span className="text-[11px] text-muted-foreground tabular-nums w-24 text-right">
                                {r.days} days · {r.late} late
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </ChartCard>
            </>
          )}
        </>
      )}

      {view === "details" && (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
              <Search className="w-4 h-4 shrink-0" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none w-full font-medium"
              />
            </div>
            <select
              value={activeFilter ?? ""}
              onChange={(e) => setActiveFilter(e.target.value || null)}
              className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
            >
              <option value="">All status</option>
              <option value="present">Present · {summary.present}</option>
              <option value="late">Late · {summary.late}</option>
              <option value="half_day">Half day · {summary.halfDay}</option>
              <option value="early_leaving">
                Early leave · {summary.earlyLeaving}
              </option>
              <option value="absent">Absent · {summary.absent}</option>
              <option value="on_leave">On leave · {summary.leave}</option>
              {!isEmployee && (
                <option value="not_checked_in">Not checked in</option>
              )}
            </select>
            <button
              type="button"
              onClick={() => saveDefault(activeFilter)}
              disabled={(activeFilter ?? null) === defaultStatus}
              title="Open this page on the selected status next time"
              className="border-2 border-black bg-white px-3 py-2 text-xs font-bold hover:bg-[#024BAB]/5 disabled:opacity-60 disabled:cursor-default"
            >
              {(activeFilter ?? null) === defaultStatus
                ? defaultStatus
                  ? "Default view ✓"
                  : "Default: All"
                : activeFilter
                  ? "Set as default view"
                  : "Default → All"}
            </button>
            {!isEmployee && deptNames.length > 0 && (
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
              >
                <option value="">All departments</option>
                {deptNames.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
              className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
            >
              <option value="name">Sort: Name</option>
              <option value="checkIn">Sort: Check-in time</option>
              <option value="checkOut">Sort: Check-out time</option>
              <option value="workHours">Sort: Work hours</option>
              <option value="status">Sort: Status</option>
            </select>
            <button
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold flex items-center gap-1"
              title={sortDir === "asc" ? "Ascending" : "Descending"}
            >
              {sortDir === "asc" ? (
                <ArrowUp className="w-4 h-4" />
              ) : (
                <ArrowDown className="w-4 h-4" />
              )}
              {sortDir === "asc" ? "Asc" : "Desc"}
            </button>
            {!isEmployee && (
              <button
                onClick={saveMyView}
                title="Open Attendance with this filter and sort every time"
                className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold hover:bg-[#024BAB]/5"
              >
                Save view
              </button>
            )}
            {filtersActive && (
              <button
                onClick={() => {
                  setActiveFilter(null);
                  setSearch("");
                  setDeptFilter("");
                }}
                className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-2 hover:bg-red-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          {/* Date strip */}
          <div
            ref={stripRef}
            className="border-2 border-black bg-white mb-5 flex items-stretch"
          >
            {/* Left arrow */}
            <button
              onClick={() => setWindowStart((s) => Math.max(1, s - stripCount))}
              disabled={windowStart <= 1}
              className="px-3 border-r-2 border-black hover:bg-[#024BAB]/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Day cells */}
            <div className="flex flex-1 overflow-hidden">
              {stripDays.map(
                ({ day, date, iso, presentCount, absentCount }) => {
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
                        {date.toLocaleDateString("en-IN", { month: "short" })}{" "}
                        {day}
                      </span>

                      {/* Present / absent counts */}
                      {presentCount > 0 || absentCount > 0 ? (
                        <div className="flex flex-col items-center gap-0.5">
                          {presentCount > 0 && (
                            <span
                              className={cn(
                                "text-[11px] font-bold leading-none",
                                isSelected
                                  ? "text-[#86efac]"
                                  : "text-[#00C48C]",
                              )}
                            >
                              {presentCount}P
                            </span>
                          )}
                          {absentCount > 0 && (
                            <span
                              className={cn(
                                "text-[11px] font-bold leading-none",
                                isSelected
                                  ? "text-[#fca5a5]"
                                  : "text-[#EF4444]",
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
                            isSelected
                              ? "text-white/40"
                              : "text-muted-foreground/40",
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
                },
              )}
            </div>

            {/* Right arrow */}
            <button
              onClick={() =>
                setWindowStart((s) =>
                  Math.max(
                    1,
                    Math.min(daysInMonth - stripCount + 1, s + stripCount),
                  ),
                )
              }
              disabled={windowStart + stripCount > daysInMonth}
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
                    (r) =>
                      r.status !== "not_checked_in" && r.status !== "weekend",
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
                      {unrecorded.length} employee
                      {unrecorded.length > 1 ? "s" : ""} have no record for this
                      date
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

          {!isEmployee && selectedIds.size > 0 && (
            <div className="border-2 border-black bg-[#024BAB]/5 px-3 py-3 mb-3 flex flex-wrap items-end gap-3">
              <div className="mr-1">
                <p className="text-sm font-bold">{selectedIds.size} selected</p>
                <p className="text-[11px] text-muted-foreground">
                  Edits apply to{" "}
                  {new Date(`${bulkDate}T00:00:00`).toLocaleDateString(
                    "en-IN",
                    {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    },
                  )}
                </p>
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">
                  Status
                </label>
                <select
                  value={bulk.status}
                  onChange={(e) => setBulk({ ...bulk, status: e.target.value })}
                  className="border-2 border-black bg-white px-2 py-1.5 text-sm font-semibold outline-none"
                >
                  <option value="">No change</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="half_day">Half day</option>
                  <option value="absent">Absent</option>
                  <option value="on_leave">On leave</option>
                </select>
              </div>
              {bulk.status !== "absent" && bulk.status !== "on_leave" && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      Check in
                    </label>
                    <input
                      type="time"
                      value={bulk.checkIn}
                      onChange={(e) =>
                        setBulk({ ...bulk, checkIn: e.target.value })
                      }
                      className="border-2 border-black bg-white px-2 py-1.5 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      Check out
                    </label>
                    <input
                      type="time"
                      value={bulk.checkOut}
                      onChange={(e) =>
                        setBulk({ ...bulk, checkOut: e.target.value })
                      }
                      className="border-2 border-black bg-white px-2 py-1.5 text-sm outline-none"
                    />
                  </div>
                </>
              )}
              <button
                onClick={applyBulk}
                disabled={bulkSaving}
                className="border-2 border-black bg-[#024BAB] text-white px-4 py-1.5 text-sm font-bold disabled:opacity-60"
              >
                {bulkSaving ? "Saving..." : "Apply to selected"}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="border-2 border-black bg-white px-3 py-1.5 text-sm font-bold"
              >
                Clear
              </button>
            </div>
          )}

          {}
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <img src={nesthrlogo} alt="NestAcademy" className="h-16 w-auto" />
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
                    {!isEmployee && (
                      <th className="pl-4 pr-1 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisible}
                          title="Select all shown"
                          className="w-4 h-4 accent-[#024BAB]"
                        />
                      </th>
                    )}
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
                      "",
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
                    const open = expandedRec === rec._id;
                    const fmtT = (t?: string) =>
                      t
                        ? new Date(t).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—";
                    return (
                      <Fragment key={rec._id}>
                        <tr
                          className={cn(
                            "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                            i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                          )}
                        >
                          {!isEmployee && (
                            <td className="pl-4 pr-1 py-3 w-8">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(rowEmpId(rec) || "")}
                                onChange={() =>
                                  rowEmpId(rec) && toggleOne(rowEmpId(rec)!)
                                }
                                className="w-4 h-4 accent-[#024BAB]"
                              />
                            </td>
                          )}
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
                              ? new Date(rec.checkIn).toLocaleTimeString(
                                  "en-IN",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-black text-xs">
                            {rec.checkOut
                              ? new Date(rec.checkOut).toLocaleTimeString(
                                  "en-IN",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-black text-xs">
                            {rec.workHours
                              ? `${rec.workHours.toFixed(1)}h`
                              : "—"}
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
                                VERIFY_MODE_CONFIG[mode] ||
                                VERIFY_MODE_CONFIG.manual;
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
                              <span className="text-muted-foreground text-xs">
                                —
                              </span>
                            )}
                          </td>
                          {!isEmployee && (
                            <td className="px-4 py-3">
                              {rec._id.startsWith("v_") ? (
                                rec.status === "weekend" ? null : (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() =>
                                        markAbsentSingle(
                                          (rec.employee as any)?._id,
                                        )
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
                          <td className="px-2 py-3">
                            <button
                              onClick={() =>
                                setExpandedRec(open ? null : rec._id)
                              }
                              title="Details"
                              className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                            >
                              <ChevronDown
                                className={cn(
                                  "w-4 h-4 transition-transform",
                                  open && "rotate-180",
                                )}
                              />
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-b border-black/10 bg-[#F8FAFF]">
                            <td
                              colSpan={isEmployee ? 10 : 12}
                              className="px-6 py-4"
                            >
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                {[
                                  [
                                    "Date",
                                    new Date(rec.date).toLocaleDateString(
                                      "en-IN",
                                      {
                                        weekday: "long",
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      },
                                    ),
                                  ],
                                  ["Check In", fmtT(rec.checkIn)],
                                  ["Check Out", fmtT(rec.checkOut)],
                                  [
                                    "Work Hours",
                                    rec.workHours
                                      ? `${rec.workHours.toFixed(2)}h`
                                      : "—",
                                  ],
                                  [
                                    "Overtime",
                                    (rec as any).overtime > 0
                                      ? `${(rec as any).overtime.toFixed(2)}h`
                                      : "—",
                                  ],
                                  [
                                    "Verified Via",
                                    (
                                      VERIFY_MODE_CONFIG[
                                        (rec as any).verifyMode || "manual"
                                      ] || VERIFY_MODE_CONFIG.manual
                                    ).label,
                                  ],
                                  [
                                    "Status",
                                    rec.status.replace("_", " ") +
                                      ((rec as any).earlyLeaving
                                        ? " · early leave"
                                        : ""),
                                  ],
                                  [
                                    "Employee ID",
                                    (rec.employee as any)?.employeeId || "—",
                                  ],
                                ].map(([label, value]) => (
                                  <div key={label}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                                      {label}
                                    </p>
                                    <p className="font-bold text-black capitalize">
                                      {value}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {kioskOpen && (
        <FaceKioskModal onClose={() => setKioskOpen(false)} onMarked={load} />
      )}
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
                <EmployeeCombobox
                  employees={employees}
                  value={markForm.employee}
                  onChange={(empId) => {
                    setMarkForm((f) => ({
                      ...f,
                      employee: empId,
                      checkIn: f.checkIn
                        ? defaultCheckIn(f.date, empId)
                        : f.checkIn,
                      checkOut: defaultCheckOut(f.date, empId),
                    }));
                  }}
                  className="border-2 w-full px-3 py-2 text-sm disabled:opacity-60 disabled:bg-gray-50"
                  disabled={!!editingId}
                />
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
                      // keep the typed times, but a today→past switch should not carry "now" as the check-in
                      checkIn: f.checkIn
                        ? defaultCheckIn(d, f.employee)
                        : f.checkIn,
                    }));
                  }}
                  disabled={!!editingId}
                  title={
                    editingId
                      ? "The date of an existing record can't be changed"
                      : undefined
                  }
                  className="border-2 w-full px-3 py-2 text-sm disabled:opacity-60 disabled:bg-gray-50"
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
                    type="time"
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
                    type="time"
                    value={markForm.checkOut}
                    onChange={(e) =>
                      setMarkForm({ ...markForm, checkOut: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-2">
                Times are saved on{" "}
                <b>
                  {markForm.date
                    ? new Date(`${markForm.date}T00:00:00`).toLocaleDateString(
                        "en-IN",
                        { weekday: "short", day: "numeric", month: "short" },
                      )
                    : "the selected date"}
                </b>
                {markForm.checkIn &&
                markForm.checkOut &&
                markForm.checkOut <= markForm.checkIn
                  ? ". Check-out is earlier than check-in, so it counts as the next morning."
                  : "."}
              </p>
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
