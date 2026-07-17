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
} from "lucide-react";

interface Student {
  _id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  sport: string;
  batch: string;
  avatar?: string;
}

interface AttendanceRecord {
  _id: string;
  date: string;
  status: string;
  batch?: string;
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
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Status | null>(null);
  const [showHistory, setShowHistory] = useState(true);

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
      records.forEach((r) => {
        if (r.date?.slice(0, 10) === date && r.student)
          existing[r.student._id] = r.status as Status;
      });
      setMarks(existing);
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

      {/* Attendance history: who marked what, for whom, in which sport */}
      <div className="mb-6">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="border-2 border-black bg-white px-4 py-2.5 text-sm font-bold flex items-center gap-2 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all"
        >
          <History className="w-4 h-4 text-[#024BAB]" />
          Attendance History
          <span className="text-[10px] font-bold text-muted-foreground bg-[#024BAB]/5 border border-black/10 px-1.5 py-0.5 rounded-full">
            {history.length}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              showHistory && "rotate-180",
            )}
          />
        </button>

        {showHistory && (
          <div className="mt-3 border-2 border-black bg-white overflow-hidden">
            <div className="px-4 py-3 border-b-2 border-black bg-[#024BAB]/5 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-black">
                Records for{" "}
                {new Date(date).toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b-2 border-black">
                    {[
                      "Date",
                      "Student",
                      "Sport",
                      "Batch",
                      "Status",
                      "Marked By",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-black whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-sm text-muted-foreground"
                      >
                        No attendance marked this month yet
                      </td>
                    </tr>
                  ) : (
                    history.map((r, i) => {
                      const status = r.status as Status;
                      const Icon = STATUS_ICONS[status];
                      return (
                        <tr
                          key={r._id}
                          className={cn(
                            "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                            i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                          )}
                        >
                          <td className="px-4 py-2.5 text-xs font-semibold text-black whitespace-nowrap">
                            {new Date(r.date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-2.5 text-xs font-bold text-black whitespace-nowrap">
                            {r.student
                              ? `${r.student.firstName} ${r.student.lastName}`
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-black">
                            {r.student?.sport || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-black">
                            {r.student?.batch || r.batch || "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            {Icon && (
                              <span
                                className={cn(
                                  "border-2 text-[10px] font-bold capitalize px-2 py-1 inline-flex items-center gap-1 w-fit",
                                  STATUS_COLORS[status],
                                )}
                              >
                                <Icon className="w-3 h-3" />
                                {status}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-black whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <UserCog className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              {r.markedBy?.name || "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Summary cards */}
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
                {["Student", "Sport / Batch", "Status"].map((h) => (
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
                return (
                  <tr
                    key={s._id}
                    className={cn(
                      "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                      i % 2 === 0 ? "" : "bg-[#F8FAFF]",
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
                      {s.sport} {s.batch ? `· ${s.batch}` : ""}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
