import { useState, useEffect, useCallback, useMemo } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { studentAPI, studentAttendanceAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";
import {
  GraduationCap,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  ShieldAlert,
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
  checkIn?: string;
  checkOut?: string;
  student?: { _id: string };
}

const STATUS_COLORS: Record<string, string> = {
  present: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
  late: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
  absent: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]",
  excused: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
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

function fmtTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ParentAttendancePage() {
  const { toast } = useToast();
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return { month: d.getMonth(), year: d.getFullYear() };
  });
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChildren = useCallback(async () => {
    try {
      const res = await studentAPI.getAll();
      setChildren(res.data || []);
      if (res.data?.length && !selectedChild) setSelectedChild(res.data[0]._id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await studentAttendanceAPI.getAll({
        month: String(monthCursor.month + 1),
        year: String(monthCursor.year),
        limit: "200",
      });
      setRecords(res.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCursor.month, monthCursor.year]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const childRecords = useMemo(
    () =>
      [...records]
        .filter((r) => r.student?._id === selectedChild)
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
    [records, selectedChild],
  );

  const summary = useMemo(() => {
    const present = childRecords.filter((r) => r.status === "present").length;
    const late = childRecords.filter((r) => r.status === "late").length;
    const absent = childRecords.filter((r) => r.status === "absent").length;
    const excused = childRecords.filter((r) => r.status === "excused").length;
    const total = childRecords.length;
    const marked = present + late + absent;
    const rate = marked > 0 ? Math.round(((present + late) / marked) * 100) : 0;
    return { present, late, absent, excused, total, rate };
  }, [childRecords]);

  const child = children.find((c) => c._id === selectedChild);

  const shiftMonth = (delta: number) => {
    setMonthCursor((p) => {
      let month = p.month + delta;
      let year = p.year;
      if (month < 0) {
        month = 11;
        year -= 1;
      } else if (month > 11) {
        month = 0;
        year += 1;
      }
      return { month, year };
    });
  };

  return (
    <AppLayout title="My Children Attendance">
      {children.length === 0 && !loading ? (
        <div className="text-center py-16 bg-white border-2 border-black">
          <GraduationCap className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="font-bold text-gray-400 text-lg">
            No children linked to your account yet
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Contact the academy to link your child's profile.
          </p>
        </div>
      ) : (
        <>
          {children.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {children.map((c) => (
                <button
                  key={c._id}
                  onClick={() => setSelectedChild(c._id)}
                  className={cn(
                    "flex items-center gap-2 border-2 border-black px-3 py-2 text-xs font-bold uppercase transition-colors",
                    selectedChild === c._id
                      ? "bg-[#024BAB] text-white"
                      : "bg-white text-black hover:bg-[#024BAB]/5",
                  )}
                >
                  {c.avatar ? (
                    <img
                      src={c.avatar}
                      alt={c.firstName}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[9px]">
                      {c.firstName?.[0]}
                    </span>
                  )}
                  {c.firstName} {c.lastName}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="font-display font-bold text-2xl text-black">
                {child ? `${child.firstName} ${child.lastName}` : "Attendance"}
              </h1>
              <p className="text-sm text-gray-500">
                {child?.sport} {child?.batch ? `· ${child.batch}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 border-2 border-black bg-white px-2 py-1.5">
              <button
                onClick={() => shiftMonth(-1)}
                className="p-1 hover:bg-gray-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-black w-32 text-center">
                {MONTHS[monthCursor.month]} {monthCursor.year}
              </span>
              <button
                onClick={() => shiftMonth(1)}
                className="p-1 hover:bg-gray-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              {
                label: "Present",
                value: summary.present,
                icon: UserCheck,
                bg: "bg-[#00C48C]",
              },
              {
                label: "Late",
                value: summary.late,
                icon: Clock,
                bg: "bg-[#FA731C]",
              },
              {
                label: "Absent",
                value: summary.absent,
                icon: UserX,
                bg: "bg-[#EF4444]",
              },
              {
                label: "Excused",
                value: summary.excused,
                icon: ShieldAlert,
                bg: "bg-[#024BAB]",
              },
              {
                label: "Attendance %",
                value: `${summary.rate}%`,
                icon: TrendingUp,
                bg: "bg-[#A855F7]",
              },
            ].map(({ label, value, icon: Icon, bg }) => (
              <div key={label} className="border-2 border-black bg-white p-4">
                <div
                  className={cn(
                    "w-8 h-8 border-2 border-black flex items-center justify-center mb-2",
                    bg,
                  )}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-2xl font-bold text-black leading-none">
                  {value}
                </p>
                <p className="text-[11px] font-bold mt-1.5 uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="border-2 border-black bg-white flex items-center justify-center h-48">
              <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
            </div>
          ) : childRecords.length === 0 ? (
            <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
              <Clock className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="font-bold text-black">No attendance records</p>
              <p className="text-sm text-muted-foreground mt-1">
                for {MONTHS[monthCursor.month]} {monthCursor.year}
              </p>
            </div>
          ) : (
            <div className="border-2 border-black bg-white overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-black bg-[#024BAB]/5">
                    {["Date", "Status", "Check In", "Check Out", "Batch"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {childRecords.map((r, i) => {
                    const Icon = STATUS_ICONS[r.status] || AlertCircle;
                    return (
                      <tr
                        key={r._id}
                        className={cn(
                          "border-b border-black/10",
                          i % 2 !== 0 && "bg-[#F8FAFF]",
                        )}
                      >
                        <td className="px-4 py-3 font-medium text-black text-xs">
                          {formatDate(r.date)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase border-2 capitalize",
                              STATUS_COLORS[r.status] ||
                                "bg-gray-100 text-gray-500 border-gray-300",
                            )}
                          >
                            <Icon className="w-3 h-3" />
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-black">
                          {fmtTime(r.checkIn)}
                        </td>
                        <td className="px-4 py-3 text-xs text-black">
                          {fmtTime(r.checkOut)}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {r.batch || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
