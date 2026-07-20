import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { sportsPlanAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ImportExportModal,
  type ImportHeader,
} from "@/components/ImportExportModal";
import { exportRowsToExcel } from "@/utils/excelImportExport";
import {
  Gift,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  Search,
  ArrowUp,
  ArrowDown,
  Layers,
  IndianRupee,
  Download,
  FileSpreadsheet,
  Trophy,
  Calendar,
  Repeat,
  Clock,
  FileText,
} from "lucide-react";

type ScheduleType = "unlimited" | "sessions_per_week" | "custom_days";
type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface Plan {
  _id: string;
  name: string;
  sport: string;
  sessionsPerWeek: number;
  scheduleType?: ScheduleType;
  scheduleDays?: Weekday[];
  startTime?: string;
  endTime?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description?: string;
}

const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const SCHEDULE_PRESETS: { label: string; days: Weekday[] }[] = [
  { label: "Daily", days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] },
  { label: "Weekdays", days: ["mon", "tue", "wed", "thu", "fri"] },
  { label: "Weekends", days: ["sat", "sun"] },
  { label: "Alternate (M/W/F)", days: ["mon", "wed", "fri"] },
  { label: "Alternate (T/T/S)", days: ["tue", "thu", "sat"] },
];

function scheduleLabel(p: Plan): string {
  if (p.scheduleType === "custom_days") {
    const days = p.scheduleDays || [];
    if (!days.length) return "Custom days";
    return WEEKDAYS.filter((w) => days.includes(w.key))
      .map((w) => w.label)
      .join("/");
  }
  return p.sessionsPerWeek === 0 ? "Unlimited" : `${p.sessionsPerWeek}x/week`;
}

function formatTime12(hhmm?: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function timingLabel(p: Plan): string {
  if (!p.startTime) return "—";
  return p.endTime
    ? `${formatTime12(p.startTime)}–${formatTime12(p.endTime)}`
    : formatTime12(p.startTime);
}

const PLAN_IMPORT_HEADERS: ImportHeader[] = [
  { key: "name", label: "Plan Name", required: true, example: "Elite Tennis" },
  { key: "sport", label: "Sport", required: true, example: "Tennis" },
  {
    key: "monthlyPrice",
    label: "Monthly Price",
    required: true,
    example: "2500",
  },
  {
    key: "yearlyPrice",
    label: "Yearly Price",
    required: true,
    example: "25000",
  },
  {
    key: "sessionsPerWeek",
    label: "Sessions Per Week",
    required: false,
    example: "3",
  },
  {
    key: "scheduleDays",
    label: "Schedule Days (comma-separated, e.g. mon,wed,fri)",
    required: false,
    example: "mon,wed,fri",
  },
  {
    key: "description",
    label: "Description",
    required: false,
    example: "Advanced coaching with video analysis",
  },
];

type SortKey = "name" | "sport" | "monthlyPrice" | "sessionsPerWeek";

export default function PlansPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    sport: "",
    sessionsPerWeek: "0",
    scheduleType: "sessions_per_week" as ScheduleType,
    scheduleDays: [] as Weekday[],
    startTime: "",
    endTime: "",
    monthlyPrice: "",
    yearlyPrice: "",
    description: "",
  });

  const [search, setSearch] = useState("");
  const [filterSport, setFilterSport] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [importModal, setImportModal] = useState(false);

  const planParams = useCallback(
    (pageNum: number): Record<string, string> => {
      const params: Record<string, string> = {
        page: String(pageNum),
        limit: "20",
      };
      if (search) params.search = search;
      if (filterSport) params.sport = filterSport;
      params.sortBy = sortKey;
      params.sortDir = sortDir;
      return params;
    },
    [search, filterSport, sortKey, sortDir],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await sportsPlanAPI.getAll(planParams(1));
      setPlans(r.data);
      setPage(1);
      setPages(r.pages || 1);
      setTotal(r.total ?? r.data.length);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [planParams]);

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await sportsPlanAPI.getAll(planParams(next));
      setPlans((p) => [...p, ...r.data]);
      setPage(next);
      setPages(r.pages || 1);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoadingMore(false);
  };

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm({
      name: "",
      sport: "",
      sessionsPerWeek: "0",
      scheduleType: "sessions_per_week",
      scheduleDays: [],
      startTime: "",
      endTime: "",
      monthlyPrice: "",
      yearlyPrice: "",
      description: "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim() || !form.sport.trim() || !form.monthlyPrice) {
      toast({
        title: "Missing fields",
        description: "Name, sport and monthly price are required",
        variant: "destructive",
      });
      return;
    }
    if (form.scheduleType === "custom_days" && form.scheduleDays.length === 0) {
      toast({
        title: "Missing schedule",
        description: "Select at least one day for a custom-day plan",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        sport: form.sport,
        scheduleType: form.scheduleType,
        scheduleDays: form.scheduleDays,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        sessionsPerWeek: Number(form.sessionsPerWeek) || 0,
        monthlyPrice: Number(form.monthlyPrice),
        yearlyPrice: form.yearlyPrice ? Number(form.yearlyPrice) : undefined,
        description: form.description,
      };
      if (editingId) {
        const r = await sportsPlanAPI.update(editingId, payload);
        setPlans((p) => p.map((x) => (x._id === editingId ? r.data : x)));
        toast({ title: "Plan updated" });
      } else {
        const r = await sportsPlanAPI.create(payload);
        setPlans((p) => [...p, r.data]);
        toast({ title: "Plan created" });
      }
      resetForm();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deactivate this plan?")) return;
    try {
      await sportsPlanAPI.delete(id);
      setPlans((p) => p.filter((x) => x._id !== id));
      toast({ title: "Plan deactivated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const startEdit = (p: Plan) => {
    setEditingId(p._id);
    setForm({
      name: p.name,
      sport: p.sport,
      sessionsPerWeek: String(p.sessionsPerWeek),
      scheduleType: p.scheduleType || "sessions_per_week",
      scheduleDays: p.scheduleDays || [],
      startTime: p.startTime || "",
      endTime: p.endTime || "",
      monthlyPrice: String(p.monthlyPrice),
      yearlyPrice: String(p.yearlyPrice),
      description: p.description || "",
    });
    setShowForm(true);
  };

  const [sportOptions, setSportOptions] = useState<string[]>([]);
  useEffect(() => {
    sportsPlanAPI
      .getAll({ limit: "200" })
      .then((r) =>
        setSportOptions(
          Array.from(
            new Set((r.data as Plan[]).map((p) => p.sport).filter(Boolean)),
          ).sort(),
        ),
      )
      .catch(() => {});
  }, []);

  const displayed = plans;

  const avgMonthly = plans.length
    ? Math.round(plans.reduce((s, p) => s + p.monthlyPrice, 0) / plans.length)
    : 0;

  return (
    <AppLayout title="Coaching Plans">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="font-display font-bold text-2xl text-black">
          Coaching Plans
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              exportRowsToExcel(
                PLAN_IMPORT_HEADERS.map((h) => ({
                  key: h.key,
                  label: h.label,
                })),
                displayed,
                "coaching_plans_export.xlsx",
                "Plans",
              )
            }
            className="border-2 border-black bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => setImportModal(true)}
            className="border-2 border-black bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" /> Import Excel
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-[#01368A] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Plan
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Plans
            </p>
            <p className="text-2xl font-bold text-black">{total}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00C48C]/10 border-2 border-[#00C48C] flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-[#00C48C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Sports Covered
            </p>
            <p className="text-2xl font-bold text-black">
              {sportOptions.length}
            </p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Avg. Monthly Price
            </p>
            <p className="text-2xl font-bold text-black">
              ₹{avgMonthly.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0" />
          <input
            type="text"
            placeholder="Search by plan name or sport..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full font-medium"
          />
        </div>
        <select
          value={filterSport}
          onChange={(e) => setFilterSport(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Sports</option>
          {sportOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {(search || filterSport) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterSport("");
            }}
            className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-2 hover:bg-red-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="name">Sort: Name</option>
          <option value="sport">Sort: Sport</option>
          <option value="monthlyPrice">Sort: Monthly Price</option>
          <option value="sessionsPerWeek">Sort: Sessions/Week</option>
        </select>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold flex items-center gap-1"
        >
          {sortDir === "asc" ? (
            <ArrowUp className="w-4 h-4" />
          ) : (
            <ArrowDown className="w-4 h-4" />
          )}
          {sortDir === "asc" ? "Asc" : "Desc"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border-2 border-black p-6 mb-6">
          <h3 className="font-bold text-base mb-4">
            {editingId ? "Edit Plan" : "Add Plan"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <Gift className="w-3.5 h-3.5 text-[#024BAB]" />
                Plan Name *
              </label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. Tennis - 3x/week"
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <Trophy className="w-3.5 h-3.5 text-[#024BAB]" />
                Sport *
              </label>
              <input
                value={form.sport}
                onChange={(e) =>
                  setForm((p) => ({ ...p, sport: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <Repeat className="w-3.5 h-3.5 text-[#024BAB]" />
                Schedule Type
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "unlimited", label: "Unlimited" },
                    { key: "sessions_per_week", label: "Sessions / Week" },
                    { key: "custom_days", label: "Custom Days" },
                  ] as { key: ScheduleType; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() =>
                      setForm((p) => ({ ...p, scheduleType: opt.key }))
                    }
                    className={cn(
                      "border-2 border-black px-3 py-2 text-sm font-bold transition-colors",
                      form.scheduleType === opt.key
                        ? "bg-[#024BAB] text-white"
                        : "bg-white text-black hover:bg-[#024BAB]/5",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {form.scheduleType === "sessions_per_week" && (
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                  <Repeat className="w-3.5 h-3.5 text-[#024BAB]" />
                  Sessions / Week
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.sessionsPerWeek}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, sessionsPerWeek: e.target.value }))
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                />
              </div>
            )}

            {form.scheduleType === "custom_days" && (
              <div className="md:col-span-2">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                  <Calendar className="w-3.5 h-3.5 text-[#024BAB]" />
                  Attends On (e.g. alternate-day clubs pick Mon/Wed/Fri)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SCHEDULE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        setForm((p) => ({ ...p, scheduleDays: preset.days }))
                      }
                      className="border border-black/30 px-2 py-1 text-xs font-semibold hover:border-black hover:bg-[#024BAB]/5 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const active = form.scheduleDays.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            scheduleDays: active
                              ? p.scheduleDays.filter((x) => x !== d.key)
                              : [...p.scheduleDays, d.key],
                          }))
                        }
                        className={cn(
                          "w-12 h-10 border-2 border-black text-xs font-bold transition-colors",
                          active
                            ? "bg-[#00C48C] text-white"
                            : "bg-white text-black hover:bg-[#00C48C]/10",
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                {form.scheduleDays.length === 0 && (
                  <p className="text-xs text-red-600 mt-1 font-semibold">
                    Select at least one day
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <Clock className="w-3.5 h-3.5 text-[#024BAB]" />
                Start Time
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  setForm((p) => ({ ...p, startTime: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <Clock className="w-3.5 h-3.5 text-[#024BAB]" />
                End Time
              </label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) =>
                  setForm((p) => ({ ...p, endTime: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <IndianRupee className="w-3.5 h-3.5 text-[#024BAB]" />
                Monthly Price (₹) *
              </label>
              <input
                type="number"
                value={form.monthlyPrice}
                onChange={(e) =>
                  setForm((p) => ({ ...p, monthlyPrice: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <IndianRupee className="w-3.5 h-3.5 text-[#024BAB]" />
                Yearly Price (₹)
              </label>
              <input
                type="number"
                value={form.yearlyPrice}
                onChange={(e) =>
                  setForm((p) => ({ ...p, yearlyPrice: e.target.value }))
                }
                placeholder={
                  form.monthlyPrice
                    ? `Auto: ₹${Number(form.monthlyPrice) * 12}`
                    : "Leave blank for 12x monthly"
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <FileText className="w-3.5 h-3.5 text-[#024BAB]" />
                Description
              </label>
              <input
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
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
              Save
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

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <Gift className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No plans found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {displayed.map((p) => (
              <div key={p._id} className="border-2 border-black bg-white p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-black">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sport}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(p)}
                      className="p-1.5 border border-black/10 hover:border-black"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(p._id)}
                      className="p-1.5 border border-black/10 hover:border-red-500 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-2xl font-bold text-[#024BAB]">
                  ₹{p.monthlyPrice}
                  <span className="text-xs text-muted-foreground font-medium">
                    /mo
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  ₹{p.yearlyPrice}/year · {scheduleLabel(p)}
                  {p.startTime ? ` · ${timingLabel(p)}` : ""}
                </p>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.description}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block border-2 border-black bg-white overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-[#024BAB]/5">
                  {[
                    "Name",
                    "Sport",
                    "Sessions/Week",
                    "Timing",
                    "Monthly",
                    "Yearly",
                    "Description",
                    "Actions",
                  ].map((h) => (
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
                {displayed.map((p, idx) => (
                  <tr
                    key={p._id}
                    className={cn(
                      "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                      idx % 2 === 0 ? "" : "bg-[#F8FAFF]",
                    )}
                  >
                    <td className="px-4 py-3 font-bold text-black">{p.name}</td>
                    <td className="px-4 py-3 text-black">{p.sport}</td>
                    <td className="px-4 py-3 text-black">{scheduleLabel(p)}</td>
                    <td className="px-4 py-3 text-black whitespace-nowrap">
                      {timingLabel(p)}
                    </td>
                    <td className="px-4 py-3 font-bold text-[#024BAB]">
                      ₹{p.monthlyPrice}
                    </td>
                    <td className="px-4 py-3 text-black">₹{p.yearlyPrice}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {p.description || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(p)}
                          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p._id)}
                          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-50 transition-colors"
                          title="Deactivate"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {page < pages && (
            <div className="flex flex-col items-center gap-2 mt-4">
              <p className="text-xs text-muted-foreground">
                Showing {plans.length} of {total}
              </p>
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 border-2 border-black bg-white px-4 py-2 text-sm font-bold uppercase hover:bg-[#024BAB]/5 disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
      <ImportExportModal
        open={importModal}
        onClose={() => setImportModal(false)}
        entityLabel="Plan"
        headers={PLAN_IMPORT_HEADERS}
        templateFilename="coaching_plans_import_template.xlsx"
        notes={
          <p>
            • Maximum <strong>200 plans</strong> per import.
          </p>
        }
        previewColumns={[
          { key: "name", label: "Name" },
          { key: "sport", label: "Sport" },
          { key: "monthlyPrice", label: "Monthly Price" },
          { key: "yearlyPrice", label: "Yearly Price" },
        ]}
        onImport={(rows) => sportsPlanAPI.bulkImport(rows) as any}
        onImported={load}
      />
    </AppLayout>
  );
}
