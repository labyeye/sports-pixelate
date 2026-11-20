import { useState, useEffect, useCallback, Fragment } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  studentAPI,
  studentAttendanceAPI,
  attendanceSettingsAPI,
} from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { DateStrip } from "@/components/ui/DateStrip";
import { ViewTabs, useViewTab } from "@/components/ui/ViewTabs";
import { ChartCard, NbTooltip } from "@/components/ui/ChartCard";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  FeeOverdueModal,
  FeeOverdueStudent,
} from "@/components/ui/FeeOverdueModal";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  UserCheck,
  UserX,
  ShieldAlert,
  Loader2,
  Save,
  LogIn,
  LogOut,
  CalendarClock,
  CalendarX,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ScanFace,
  ChevronDown,
  Cpu,
} from "lucide-react";
import FaceKioskModal from "@/components/attendance/FaceKioskModal";
import { StudentAttendanceInsights } from "@/components/insights/PageInsightBlocks";
import { attendanceSource } from "@/lib/attendanceSource";

interface ActivePlan {
  _id: string;
  name: string;
  scheduleType: "unlimited" | "sessions_per_week" | "custom_days";
  scheduleDays: string[];
  startTime?: string;
  endTime?: string;
}

interface Student {
  _id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  sport: string;
  batch: string;
  avatar?: string;
  activePlan?: ActivePlan | null;
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAY_LABEL: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

// A student is "expected" on a date if their plan doesn't restrict days
// (unlimited/sessions-per-week) or the date's weekday is in scheduleDays.
function isSessionDay(student: Student, dateStr: string): boolean {
  const plan = student.activePlan;
  if (!plan || plan.scheduleType !== "custom_days") return true;
  const weekday = WEEKDAY_KEYS[new Date(`${dateStr}T00:00:00`).getDay()];
  return plan.scheduleDays.includes(weekday);
}

function formatTime12(hhmm?: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

interface AttendanceRecord {
  _id: string;
  date: string;
  status: string;
  batch?: string;
  checkIn?: string;
  checkOut?: string;
  student?: {
    _id: string;
    firstName: string;
    lastName: string;
    sport?: string;
    batch?: string;
  };
  markedBy?: { name?: string };
  verifyMode?: string;
  checkInLog?: any;
  checkOutLog?: any;
}

const STATUS_OPTIONS = ["present", "late", "absent", "excused"] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const STATUS_COLORS: Record<Status, string> = {
  present: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
  late: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
  absent: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]",
  excused: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
};

const STATUS_ICONS: Record<Status, React.ElementType> = {
  present: CheckCircle,
  late: Clock,
  absent: XCircle,
  excused: AlertCircle,
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
const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StudentAttendancePage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [view, setView] = useViewTab("student-attendance");
  const { toast } = useToast();
  const [date, setDate] = useState(toDateStr(new Date()));
  const [singleTime, setSingleTime] = useState(false);
  useEffect(() => {
    attendanceSettingsAPI
      .getStudentTimeMode()
      .then((r: any) => setSingleTime(r?.data?.mode === "single"))
      .catch(() => {});
  }, []);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [times, setTimes] = useState<
    Record<string, { checkIn?: string; checkOut?: string }>
  >({});
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [punchingId, setPunchingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<Status | null>(null);
  const [kioskOpen, setKioskOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<{
    status: Status;
    checkIn: string;
    checkOut: string;
  }>({ status: "present", checkIn: "", checkOut: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [windowStart, setWindowStart] = useState<number>(
    Math.max(1, new Date().getDate() - 3),
  );

  const [selYear, selMonth] = date.split("-").map(Number);
  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const todayIso = toDateStr(new Date());

  const changeMonthYear = (m: number, y: number) => {
    const dim = new Date(y, m, 0).getDate();
    const day = Math.min(Number(date.split("-")[2]), dim);
    setDate(
      `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
    setWindowStart(Math.max(1, Math.min(day - 3, dim - 6)));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [studentsRes, attRes] = await Promise.all([
        studentAPI.getAll({ status: "active" }),
        studentAttendanceAPI.getAll({
          month: String(new Date(date).getMonth() + 1),
          year: String(new Date(date).getFullYear()),
        }),
      ]);
      setStudents(studentsRes.data);
      const records: AttendanceRecord[] = attRes.data || [];
      const existing: Record<string, Status> = {};
      const existingTimes: Record<
        string,
        { checkIn?: string; checkOut?: string }
      > = {};
      records.forEach((r) => {
        if (r.date?.slice(0, 10) === date && r.student) {
          existing[r.student._id] = r.status as Status;
          existingTimes[r.student._id] = {
            checkIn: r.checkIn,
            checkOut: r.checkOut,
          };
        }
      });
      setMarks(existing);
      setTimes(existingTimes);
      setHistory(
        [...records].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
      );
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const [feeBlock, setFeeBlock] = useState<FeeOverdueStudent[] | null>(null);
  // Returns true when the error was a fee-overdue refusal (modal shown).
  const handleFeeBlock = (err: any) => {
    if (err?.code !== "FEE_OVERDUE") return false;
    setFeeBlock(err.details?.students || []);
    return true;
  };

  const setStatus = (studentId: string, status: Status) => {
    setMarks((p) => ({ ...p, [studentId]: status }));
  };

  const punch = async (studentId: string, action: "checkin" | "checkout") => {
    setPunchingId(studentId);
    try {
      const now = new Date().toISOString();
      const body: Record<string, any> = { student: studentId, date };
      if (action === "checkin") body.checkIn = now;
      else body.checkOut = now;
      const res = await studentAttendanceAPI.mark(body);
      const rec = res.data;
      setTimes((p) => ({
        ...p,
        [studentId]: { checkIn: rec.checkIn, checkOut: rec.checkOut },
      }));
      setMarks((p) => ({ ...p, [studentId]: rec.status }));
      toast({
        title: action === "checkin" ? "Checked in" : "Checked out",
      });
    } catch (e: unknown) {
      if (handleFeeBlock(e)) return;
      toast({
        title: "Error",
        description: getErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setPunchingId(null);
    }
  };

  // Use LOCAL date/time so IST midnight stored as UTC doesn't shift the day
  const toLocalInput = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  };

  // "2024-06-10T09:00" from datetime-local has no timezone.
  // new Date() in the browser parses it as local (IST), so .toISOString() gives
  // the correct UTC equivalent before it's sent to the server.
  const localToISO = (s: string) => (s ? new Date(s).toISOString() : undefined);

  const openEdit = (s: Student) => {
    setEditingStudent(s);
    setEditForm({
      status: (marks[s._id] as Status) || "present",
      checkIn: toLocalInput(times[s._id]?.checkIn),
      checkOut: toLocalInput(times[s._id]?.checkOut),
    });
    setEditModal(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setSavingEdit(true);
    try {
      const body: Record<string, any> = {
        student: editingStudent._id,
        date,
        status: editForm.status,
      };
      if (editForm.checkIn) body.checkIn = localToISO(editForm.checkIn);
      if (editForm.checkOut) body.checkOut = localToISO(editForm.checkOut);
      const res = await studentAttendanceAPI.mark(body);
      const rec = res.data;
      setTimes((p) => ({
        ...p,
        [editingStudent._id]: { checkIn: rec.checkIn, checkOut: rec.checkOut },
      }));
      setMarks((p) => ({ ...p, [editingStudent._id]: rec.status }));
      toast({ title: "Attendance updated" });
      setEditModal(false);
      setEditingStudent(null);
    } catch (err: unknown) {
      if (handleFeeBlock(err)) {
        setEditModal(false);
        return;
      }
      toast({
        title: "Error",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const records = students
        .filter((s) => marks[s._id])
        .map((s) => ({ student: s._id, status: marks[s._id], batch: s.batch }));
      if (records.length === 0) {
        toast({
          title: "Nothing to save",
          description: "Mark at least one student first",
        });
        return;
      }
      const res = await studentAttendanceAPI.bulkMark({ date, records });
      const blocked: FeeOverdueStudent[] = res.blocked || [];
      toast({
        title: `Saved attendance for ${records.length - blocked.length} student(s)`,
      });
      if (blocked.length) setFeeBlock(blocked);
      await load();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Only students scheduled on the selected date; anyone already marked that
  // day stays visible so recorded attendance never disappears.
  const scheduledStudents = students.filter(
    (s) => marks[s._id] || isSessionDay(s, date),
  );

  const summary = {
    total: scheduledStudents.length,
    present: students.filter((s) => marks[s._id] === "present").length,
    late: students.filter((s) => marks[s._id] === "late").length,
    absent: students.filter((s) => marks[s._id] === "absent").length,
    excused: students.filter((s) => marks[s._id] === "excused").length,
    unmarked: scheduledStudents.filter((s) => !marks[s._id]).length,
  };

  const attendancePct = summary.total
    ? Math.round(((summary.present + summary.late) / summary.total) * 100)
    : 0;
  const statusSplit = [
    { name: "Present", value: summary.present, color: "#00C48C" },
    { name: "Late", value: summary.late, color: "#CA8A04" },
    { name: "Excused", value: summary.excused, color: "#3B82F6" },
    { name: "Absent", value: summary.absent, color: "#EF4444" },
  ].filter((x) => x.value > 0);
  const trend = Object.values(
    history.reduce(
      (acc, r) => {
        const d = r.date?.slice(0, 10);
        if (!d) return acc;
        const row = (acc[d] ||= {
          date: d,
          label: String(Number(d.slice(8, 10))),
          Present: 0,
          Late: 0,
          Excused: 0,
          Absent: 0,
        });
        if (r.status === "present") row.Present++;
        else if (r.status === "late") {
          row.Late++;
          row.Present++;
        } else if (r.status === "excused") row.Excused++;
        else if (r.status === "absent") row.Absent++;
        return acc;
      },
      {} as Record<string, any>,
    ),
  ).sort((a: any, b: any) => a.date.localeCompare(b.date));

  const displayedStudents = activeFilter
    ? activeFilter === ("unmarked" as any)
      ? scheduledStudents.filter((s) => !marks[s._id])
      : scheduledStudents.filter((s) => marks[s._id] === activeFilter)
    : scheduledStudents;

  return (
    <AppLayout title="Student Attendance">
      {/* Top bar: month/year + save button */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <select
            value={selMonth}
            onChange={(e) => changeMonthYear(Number(e.target.value), selYear)}
            className="border-2 border-black px-3 py-2 text-sm font-semibold outline-none bg-white"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={selYear}
            onChange={(e) => changeMonthYear(selMonth, Number(e.target.value))}
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
          {activeFilter && (
            <button
              onClick={() => setActiveFilter(null)}
              className="border-2 border-black px-3 py-2 text-xs font-bold bg-white hover:bg-gray-50 flex items-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" /> Clear filter
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setKioskOpen(true)}
            className="border-2 border-black bg-white text-[#024BAB] px-4 py-2 text-sm font-bold flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
          >
            <ScanFace className="w-4 h-4" /> Face Attendance
          </button>
          <button
            onClick={saveAll}
            disabled={saving}
            className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold flex items-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none hover:bg-[#01368A] transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Attendance
          </button>
        </div>
      </div>

      <StudentAttendanceInsights />

      <ViewTabs value={view} onChange={setView} className="mb-4" />

      {view === "graphs" && (
        <>
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
                    ).map((x) => (
                      <Cell key={x.name} fill={x.color} />
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
                {new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
                <span className="text-muted-foreground font-medium">
                  {" "}
                  · {summary.total} scheduled
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
                    label: "Excused",
                    n: summary.excused,
                    color: "#3B82F6",
                    key: "excused",
                  },
                  {
                    label: "Absent",
                    n: summary.absent,
                    color: "#EF4444",
                    key: "absent",
                  },
                  {
                    label: "Unmarked",
                    n: summary.unmarked,
                    color: "#9CA3AF",
                    key: "unmarked",
                  },
                ].map((k) => (
                  <button
                    key={k.key}
                    onClick={() => {
                      setActiveFilter(k.key as any);
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
            subtitle="Students present vs absent on each day"
            empty={trend.length ? undefined : "No attendance data yet"}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={trend}
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
                />
                <Tooltip content={<NbTooltip />} />
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, fontWeight: 700 }}
                />
                {[
                  { key: "Present", color: "#00C48C" },
                  { key: "Late", color: "#CA8A04" },
                  { key: "Excused", color: "#3B82F6" },
                  { key: "Absent", color: "#EF4444" },
                ].map(({ key, color }) => (
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
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}

      {view === "details" && (
        <>
          <DateStrip
            year={selYear}
            month={selMonth}
            selected={date}
            onSelect={(iso) => iso && setDate(iso)}
            badges={(iso) => {
              const recs = history.filter((r) => r.date?.slice(0, 10) === iso);
              const p = recs.filter(
                (r) => r.status === "present" || r.status === "late",
              ).length;
              const ab = recs.filter((r) => r.status === "absent").length;
              return [
                ...(p ? [{ text: `${p}P`, color: "#00C48C" }] : []),
                ...(ab ? [{ text: `${ab}A`, color: "#EF4444" }] : []),
              ];
            }}
          />

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <img src={nesthrlogo} alt="NestAcademy" className="h-16 w-auto" />
            </div>
          ) : displayedStudents.length === 0 ? (
            <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
              <Clock className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="font-bold text-black">No students found</p>
              <p className="text-sm text-muted-foreground mt-1">
                for {new Date(date).toLocaleDateString("en-IN")}
              </p>
            </div>
          ) : (
            <div className="border-2 border-black bg-white overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-black bg-[#024BAB]/5">
                    {[
                      "Student",
                      "Sport / Batch",
                      singleTime ? "Time" : "Check In / Out",
                      "Status",
                      "",
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
                  {displayedStudents.map((s, i) => {
                    const current = marks[s._id];
                    const sessionDay = isSessionDay(s, date);
                    const open = expandedId === s._id;
                    const studentHistory = history
                      .filter((r) => r.student?._id === s._id)
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .slice(0, 10);
                    return (
                      <Fragment key={s._id}>
                        <tr
                          className={cn(
                            "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                            !sessionDay
                              ? "bg-yellow-50/60"
                              : i % 2 === 0
                                ? ""
                                : "bg-[#F8FAFF]",
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {s.avatar ? (
                                <img
                                  src={s.avatar}
                                  alt={s.firstName}
                                  className="w-7 h-7 border-2 border-black object-cover shrink-0 rounded-full"
                                />
                              ) : (
                                <div className="w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[10px] font-bold text-white shrink-0 rounded-full">
                                  {s.firstName?.[0]?.toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-black text-xs">
                                  {s.firstName} {s.lastName}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {s.studentId}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-black text-xs">
                            <div>
                              {s.sport} {s.batch ? `· ${s.batch}` : ""}
                            </div>
                            {s.activePlan ? (
                              <div className="flex items-center gap-1 mt-1">
                                {sessionDay ? (
                                  <CalendarClock className="w-3 h-3 text-[#00C48C] shrink-0" />
                                ) : (
                                  <CalendarX className="w-3 h-3 text-[#FA731C] shrink-0" />
                                )}
                                <span
                                  className={cn(
                                    "text-[10px] font-semibold",
                                    sessionDay
                                      ? "text-muted-foreground"
                                      : "text-[#FA731C]",
                                  )}
                                  title={
                                    s.activePlan.scheduleType === "custom_days"
                                      ? s.activePlan.scheduleDays
                                          .map((d) => WEEKDAY_LABEL[d])
                                          .join(", ")
                                      : "Any day"
                                  }
                                >
                                  {s.activePlan.name}
                                  {s.activePlan.startTime &&
                                    ` · ${formatTime12(s.activePlan.startTime)}${
                                      s.activePlan.endTime
                                        ? `–${formatTime12(s.activePlan.endTime)}`
                                        : ""
                                    }`}
                                  {!sessionDay && " · not scheduled today"}
                                </span>
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => punch(s._id, "checkin")}
                                disabled={punchingId === s._id}
                                className="border-2 border-black bg-white text-[10px] font-bold px-2 py-1 flex items-center gap-1 hover:bg-[#00C48C]/10 hover:border-[#00C48C] disabled:opacity-50"
                                title="Check in now"
                              >
                                <LogIn className="w-3 h-3" />
                                {times[s._id]?.checkIn
                                  ? new Date(
                                      times[s._id].checkIn!,
                                    ).toLocaleTimeString("en-IN", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : singleTime
                                    ? "Set Time"
                                    : "Check In"}
                              </button>
                              {!singleTime && (
                                <button
                                  onClick={() => punch(s._id, "checkout")}
                                  disabled={punchingId === s._id}
                                  className="border-2 border-black bg-white text-[10px] font-bold px-2 py-1 flex items-center gap-1 hover:bg-[#FA731C]/10 hover:border-[#FA731C] disabled:opacity-50"
                                  title="Check out now"
                                >
                                  <LogOut className="w-3 h-3" />
                                  {times[s._id]?.checkOut
                                    ? new Date(
                                        times[s._id].checkOut!,
                                      ).toLocaleTimeString("en-IN", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "Check Out"}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {STATUS_OPTIONS.map((opt) => {
                                const Icon = STATUS_ICONS[opt];
                                const selected = current === opt;
                                return (
                                  <button
                                    key={opt}
                                    onClick={() => setStatus(s._id, opt)}
                                    className={cn(
                                      "border-2 text-[10px] font-bold capitalize px-2 py-1 flex items-center gap-1 transition-colors",
                                      selected
                                        ? STATUS_COLORS[opt]
                                        : "bg-white text-gray-400 border-gray-300 hover:border-black",
                                    )}
                                  >
                                    <Icon className="w-3 h-3" />
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                            {(() => {
                              const src = attendanceSource(
                                history.find(
                                  (r) =>
                                    r.student?._id === s._id &&
                                    r.date?.slice(0, 10) === date,
                                ),
                              );
                              return src ? (
                                <p
                                  title={src.detail}
                                  className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-muted-foreground"
                                >
                                  {src.kind === "device" ? (
                                    <Cpu className="w-3 h-3 text-[#024BAB]" />
                                  ) : (
                                    <UserCheck className="w-3 h-3 text-[#FA731C]" />
                                  )}
                                  {src.label}
                                </p>
                              ) : null;
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => openEdit(s)}
                              title="Edit attendance"
                              className="p-1.5 border-2 border-black hover:bg-[#024BAB] hover:text-white transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </td>
                          <td className="px-2 py-3">
                            <button
                              onClick={() => setExpandedId(open ? null : s._id)}
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
                            <td colSpan={6} className="px-6 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                    Plan
                                  </p>
                                  <p className="font-bold text-black">
                                    {s.activePlan?.name || "No active plan"}
                                  </p>
                                  {s.activePlan && (
                                    <p className="text-muted-foreground mt-0.5">
                                      {s.activePlan.scheduleType ===
                                      "custom_days"
                                        ? s.activePlan.scheduleDays
                                            .map((d) => WEEKDAY_LABEL[d])
                                            .join(", ")
                                        : "Any day"}
                                      {s.activePlan.startTime &&
                                        ` · ${formatTime12(s.activePlan.startTime)}${
                                          s.activePlan.endTime
                                            ? `–${formatTime12(s.activePlan.endTime)}`
                                            : ""
                                        }`}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                    Today
                                  </p>
                                  <p className="text-black">
                                    In:{" "}
                                    <span className="font-bold">
                                      {times[s._id]?.checkIn
                                        ? new Date(
                                            times[s._id].checkIn!,
                                          ).toLocaleTimeString("en-IN", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })
                                        : "—"}
                                    </span>
                                    {!singleTime && (
                                      <>
                                        {" "}
                                        · Out:{" "}
                                        <span className="font-bold">
                                          {times[s._id]?.checkOut
                                            ? new Date(
                                                times[s._id].checkOut!,
                                              ).toLocaleTimeString("en-IN", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })
                                            : "—"}
                                        </span>
                                      </>
                                    )}
                                  </p>
                                  <p className="text-black mt-0.5">
                                    Status:{" "}
                                    <span className="font-bold capitalize">
                                      {current || "not marked"}
                                    </span>
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                    Recent this month
                                  </p>
                                  {studentHistory.length === 0 ? (
                                    <p className="text-muted-foreground">
                                      No records
                                    </p>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {studentHistory.map((r) => (
                                        <span
                                          key={r._id}
                                          title={r.status}
                                          className={cn(
                                            "border-2 text-[10px] font-bold px-1.5 py-0.5 capitalize",
                                            STATUS_COLORS[r.status as Status] ||
                                              "border-gray-300 text-gray-500",
                                          )}
                                        >
                                          {r.date.slice(8, 10)} · {r.status}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
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

      {editModal && editingStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">
                Edit Attendance — {editingStudent.firstName}{" "}
                {editingStudent.lastName}
              </h3>
              <button
                onClick={() => {
                  setEditModal(false);
                  setEditingStudent(null);
                }}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      status: e.target.value as Status,
                    })
                  }
                  className="border-2 w-full px-3 py-2 text-sm"
                  required
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="capitalize">
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  {singleTime ? "Time" : "Check In"}
                </label>
                <input
                  type="datetime-local"
                  value={editForm.checkIn}
                  onChange={(e) =>
                    setEditForm({ ...editForm, checkIn: e.target.value })
                  }
                  className="border-2 w-full px-3 py-2 text-sm"
                />
              </div>
              {!singleTime && (
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Check Out
                  </label>
                  <input
                    type="datetime-local"
                    value={editForm.checkOut}
                    onChange={(e) =>
                      setEditForm({ ...editForm, checkOut: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditModal(false);
                    setEditingStudent(null);
                  }}
                  className="border-2 border-black px-4 py-2 text-sm font-bold bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-60"
                >
                  {savingEdit ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {kioskOpen && (
        <FaceKioskModal onClose={() => setKioskOpen(false)} onMarked={load} />
      )}
      <FeeOverdueModal students={feeBlock} onClose={() => setFeeBlock(null)} />
    </AppLayout>
  );
}
