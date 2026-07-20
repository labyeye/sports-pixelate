import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { holidayAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ActionModal } from "@/components/ui/ActionModal";
import {
  CalendarDays,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  Gift,
  Flag,
  Lock,
  CalendarCheck,
  CalendarClock,
} from "lucide-react";

interface Holiday {
  _id: string;
  name: string;
  date: string;
  type: "national" | "optional" | "restricted";
  description?: string;
  isActive: boolean;
}

const TYPE_META = {
  national: {
    label: "National",
    icon: Flag,
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-700",
    dot: "bg-red-500",
    rowBg: "bg-red-50/40",
  },
  optional: {
    label: "Optional",
    icon: Gift,
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-700",
    dot: "bg-orange-400",
    rowBg: "bg-orange-50/40",
  },
  restricted: {
    label: "Restricted",
    icon: Lock,
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    text: "text-yellow-700",
    dot: "bg-yellow-400",
    rowBg: "bg-yellow-50/40",
  },
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
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function TypeBadge({ type }: { type: Holiday["type"] }) {
  const m = TYPE_META[type];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold uppercase border",
        m.bg,
        m.border,
        m.text,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export default function HolidaysPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === "super_admin" || user?.role === "hr_manager";

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionModal, setActionModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    date: "",
    type: "national" as Holiday["type"],
    description: "",
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await holidayAPI.getAll({ year: String(year) });
      setHolidays(r.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const resetForm = () => {
    setForm({ name: "", date: "", type: "national", description: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim()) {
      setActionModal({
        show: true,
        type: "error",
        title: "Required Field Missing",
        message: "Please fill in: Holiday Name",
      });
      return;
    }
    if (!form.date) {
      setActionModal({
        show: true,
        type: "error",
        title: "Required Field Missing",
        message: "Please fill in: Date",
      });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const r = await holidayAPI.update(editingId, form);
        setHolidays((p) => p.map((h) => (h._id === editingId ? r.data : h)));
        toast({ title: "Holiday updated" });
      } else {
        const r = await holidayAPI.create(form);
        setHolidays((p) =>
          [...p, r.data].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          ),
        );
        toast({ title: "Holiday added" });
      }
      resetForm();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this holiday?")) return;
    try {
      await holidayAPI.delete(id);
      setHolidays((p) => p.filter((h) => h._id !== id));
      toast({ title: "Holiday deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const startEdit = (h: Holiday) => {
    setEditingId(h._id);
    setForm({
      name: h.name,
      date: h.date.slice(0, 10),
      type: h.type,
      description: h.description || "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const grouped: Record<number, Holiday[]> = {};
  holidays.forEach((h) => {
    const m = new Date(h.date).getMonth();
    if (!grouped[m]) grouped[m] = [];
    grouped[m].push(h);
  });

  const totalNational = holidays.filter(
    (h) => h.type === "national" && h.isActive,
  ).length;
  const totalOptional = holidays.filter(
    (h) => h.type === "optional" && h.isActive,
  ).length;
  const totalRestricted = holidays.filter(
    (h) => h.type === "restricted" && h.isActive,
  ).length;

  const upcomingHolidays = holidays.filter(
    (h) => new Date(h.date) >= new Date(now.toDateString()),
  ).length;
  const thisMonthHolidays = holidays.filter((h) => {
    const d = new Date(h.date);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  }).length;

  return (
    <AppLayout title="Holidays">
      <div className="max-w-5xl mx-auto">
        {}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-3xl text-black">
              SportsClub Holidays
            </h1>
            <p className="text-gray-600 font-medium mt-1">
              Declare holidays — attendance is automatically blocked on these
              dates
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase"
            >
              <Plus className="w-4 h-4" /> Add Holiday
            </button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
          <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-[#024BAB]" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Total Holidays
              </p>
              <p className="text-2xl font-bold text-black">{holidays.length}</p>
            </div>
          </div>
          <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00C48C]/10 border-2 border-[#00C48C] flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5 text-[#00C48C]" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Upcoming
              </p>
              <p className="text-2xl font-bold text-black">
                {upcomingHolidays}
              </p>
            </div>
          </div>
          <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FA731C]/10 border-2 border-[#FA731C] flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5 text-[#FA731C]" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                This Month
              </p>
              <p className="text-2xl font-bold text-black">
                {thisMonthHolidays}
              </p>
            </div>
          </div>
        </div>

        {}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-0 border-2 border-black bg-white overflow-hidden">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="px-3 py-2 font-bold text-lg hover:bg-gray-50 border-r-2 border-black"
            >
              ‹
            </button>
            <span className="px-4 py-2 font-bold text-base">{year}</span>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="px-3 py-2 font-bold text-lg hover:bg-gray-50 border-l-2 border-black"
            >
              ›
            </button>
          </div>
          <div className="flex gap-3">
            {(["national", "optional", "restricted"] as const).map((t) => {
              const m = TYPE_META[t];
              const count =
                t === "national"
                  ? totalNational
                  : t === "optional"
                    ? totalOptional
                    : totalRestricted;
              return (
                <div
                  key={t}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 border-2 text-sm font-bold",
                    m.bg,
                    m.border,
                    m.text,
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", m.dot)} />
                  {m.label}: {count}
                </div>
              );
            })}
          </div>
        </div>

        {}
        {showForm && canManage && (
          <div className="bg-white border-2 border-black p-6 mb-6">
            <h3 className="font-bold text-base mb-4">
              {editingId ? "Edit Holiday" : "Add Holiday"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">
                  Holiday Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Republic Day"
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, date: e.target.value }))
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">
                  Type *
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      type: e.target.value as Holiday["type"],
                    }))
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none"
                >
                  <option value="national">
                    National — applies to everyone
                  </option>
                  <option value="optional">
                    Optional — employee can choose
                  </option>
                  <option value="restricted">
                    Restricted — limited to specific employees
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">
                  Description (optional)
                </label>
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Additional notes"
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={resetForm}
                className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-bold text-sm uppercase"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          </div>
        )}

        {}
        {loading ? (
          <div className="flex justify-center py-16">
            <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
          </div>
        ) : holidays.length === 0 ? (
          <div className="text-center py-16 bg-white border-2 border-black">
            <CalendarDays className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <p className="font-bold text-gray-400 text-lg">
              No holidays for {year}
            </p>
            {canManage && (
              <p className="text-sm text-gray-400 mt-1">
                Click "Add Holiday" to declare SportsClub holidays.
              </p>
            )}
          </div>
        ) : (
          <div className="border-2 border-black bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-[#024BAB]">
                  {[
                    "Date",
                    "Day",
                    "Holiday",
                    "Type",
                    "Description",
                    "Status",
                    ...(canManage ? ["Actions"] : []),
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }, (_, i) => i)
                  .filter((m) => grouped[m])
                  .map((m) => (
                    <>
                      {}
                      <tr
                        key={`month-${m}`}
                        className="border-b border-black/10"
                      >
                        <td
                          colSpan={canManage ? 7 : 6}
                          className="px-4 py-2 bg-[#024BAB]/5 border-t-2 border-[#024BAB]/20"
                        >
                          <span className="text-xs font-bold uppercase tracking-widest text-[#024BAB]">
                            {MONTHS[m]} · {grouped[m].length} holiday
                            {grouped[m].length > 1 ? "s" : ""}
                          </span>
                        </td>
                      </tr>
                      {grouped[m].map((h) => {
                        const d = new Date(h.date);
                        const dayName = DAYS[d.getDay()];
                        const dayNum = d.getDate();
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        const m2 = TYPE_META[h.type];
                        return (
                          <tr
                            key={h._id}
                            className={cn(
                              "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                              !h.isActive && "opacity-50",
                            )}
                          >
                            <td className="px-4 py-3">
                              <div
                                className={cn(
                                  "w-11 h-11 border-2 border-black flex flex-col items-center justify-center",
                                  m2.bg,
                                )}
                              >
                                <span className="text-[9px] font-bold uppercase text-gray-500">
                                  {dayName}
                                </span>
                                <span
                                  className={cn(
                                    "text-lg font-bold leading-none",
                                    m2.text,
                                  )}
                                >
                                  {dayNum}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-bold text-gray-500 uppercase">
                                {dayName}
                              </span>
                              {isWeekend && (
                                <span className="ml-1.5 text-[10px] font-bold text-gray-400 border border-gray-200 px-1 py-0.5">
                                  WE
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-bold text-black">
                                {h.name}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <TypeBadge type={h.type} />
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 max-w-40">
                              <span className="line-clamp-1">
                                {h.description || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "text-xs font-bold uppercase px-2 py-0.5 border",
                                  h.isActive
                                    ? "bg-green-50 text-green-700 border-green-300"
                                    : "bg-gray-50 text-gray-400 border-gray-200",
                                )}
                              >
                                {h.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            {canManage && (
                              <td className="px-4 py-3">
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => startEdit(h)}
                                    className="p-1.5 border border-gray-200 hover:border-black hover:bg-gray-50 transition-all"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(h._id)}
                                    className="p-1.5 border border-gray-200 hover:border-red-500 hover:text-red-500 hover:bg-red-50 transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {}
        <div className="mt-6 p-4 bg-blue-50 border-2 border-[#024BAB]/20">
          <p className="text-xs font-bold uppercase text-[#024BAB] mb-2">
            How holidays affect attendance
          </p>
          <ul className="text-xs text-gray-600 space-y-1 font-medium">
            <li>
              🔴 <strong>National:</strong> Attendance automatically blocked.
              Check-in is recorded but status is set to "holiday".
            </li>
            <li>
              🟠 <strong>Optional:</strong> Employee can choose whether to work.
              Attendance recorded normally if they check in.
            </li>
            <li>
              🟡 <strong>Restricted:</strong> Only applicable to employees with
              leave balance. HR manages individually.
            </li>
          </ul>
        </div>
      </div>

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
