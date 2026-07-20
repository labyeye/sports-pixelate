import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { studentAPI, studentAttendanceAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
  History,
  ChevronDown,
  UserCog,
  LogIn,
  LogOut,
  CalendarClock,
  CalendarX,
  Pencil,
} from "lucide-react";

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

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StudentAttendancePage() {
  const { toast } = useToast();
  const [date, setDate] = useState(toDateStr(new Date()));
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
  const [showHistory, setShowHistory] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<{
    status: Status;
    checkIn: string;
    checkOut: string;
  }>({ status: "present", checkIn: "", checkOut: "" });
  const [savingEdit, setSavingEdit] = useState(false);

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
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

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
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
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
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
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
      await studentAttendanceAPI.bulkMark({ date, records });
      toast({ title: `Saved attendance for ${records.length} student(s)` });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const summary = {
    total: students.length,
    present: students.filter((s) => marks[s._id] === "present").length,
    late: students.filter((s) => marks[s._id] === "late").length,
    absent: students.filter((s) => marks[s._id] === "absent").length,
    excused: students.filter((s) => marks[s._id] === "excused").length,
    unmarked: students.filter((s) => !marks[s._id]).length,
  };

  const displayedStudents = activeFilter
    ? activeFilter === ("unmarked" as any)
      ? students
      : students.filter((s) => marks[s._id] === activeFilter)
    : students;

  return (
    <AppLayout title="Student Attendance">
      {/* Top bar: date + save button */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border-2 border-black px-3 py-2 text-sm font-semibold outline-none bg-white"
          />
          {activeFilter && (
            <button
              onClick={() => setActiveFilter(null)}
              className="border-2 border-black px-3 py-2 text-xs font-bold bg-white hover:bg-gray-50 flex items-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" /> Clear filter
            </button>
          )}
        </div>
        <button
          onClick={saveAll}
          disabled={saving}
          className="border-2 border-black bg-[#024BAB] text-white px-4 py-2.5 text-sm font-bold flex items-center gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-60 disabled:pointer-events-none"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Attendance
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          {
            label: "Total",
            value: summary.total,
            icon: Users,
            bg: "bg-[#024BAB]",
            filterKey: "total",
          },
          {
            label: "Present",
            value: summary.present,
            icon: UserCheck,
            bg: "bg-[#00C48C]",
            filterKey: "present",
          },
          {
            label: "Late",
            value: summary.late,
            icon: Clock,
            bg: "bg-[#FA731C]",
            filterKey: "late",
          },
          {
            label: "Absent",
            value: summary.absent,
            icon: UserX,
            bg: "bg-[#EF4444]",
            filterKey: "absent",
          },
          {
            label: "Excused",
            value: summary.excused,
            icon: ShieldAlert,
            bg: "bg-[#FA731C]",
            filterKey: "excused",
          },
          {
            label: "Unmarked",
            value: summary.unmarked,
            icon: Clock,
            bg: "bg-gray-400",
            filterKey: "unmarked",
          },
        ].map(({ label, value, icon: Icon, bg, filterKey }) => {
          const isActive = activeFilter === filterKey;
          return (
            <button
              key={filterKey}
              onClick={() =>
                setActiveFilter(
                  isActive || filterKey === "total"
                    ? null
                    : (filterKey as Status),
                )
              }
              className={cn(
                "border-2 border-black p-4 flex flex-col gap-2 text-left transition-all",
                isActive
                  ? `${bg} text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]`
                  : "bg-white hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]",
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 border-2 border-black flex items-center justify-center shrink-0",
                  isActive ? "bg-white/20 border-white/40" : bg,
                )}
              >
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p
                  className={cn(
                    "text-2xl font-bold leading-none",
                    isActive ? "text-white" : "text-black",
                  )}
                >
                  {value}
                </p>
                <p
                  className={cn(
                    "text-[11px] font-bold mt-1 uppercase tracking-wider",
                    isActive
                      ? "text-white opacity-80"
                      : "text-muted-foreground",
                  )}
                >
                  {label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="border-2 border-black bg-white flex items-center justify-center h-48">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
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
                  "Check In / Out",
                  "Status",
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
                return (
                  <tr
                    key={s._id}
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
                        <span className="font-bold text-black text-xs">
                          {s.firstName} {s.lastName}
                        </span>
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
                            : "Check In"}
                        </button>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
                  Check In
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
    </AppLayout>
  );
}
