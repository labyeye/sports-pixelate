import { useState, useEffect, useCallback, useMemo } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { sportsPlanAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

interface Plan {
  _id: string;
  name: string;
  sport: string;
  sessionsPerWeek: number;
  monthlyPrice: number;
  yearlyPrice: number;
  description?: string;
}

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
    monthlyPrice: "",
    yearlyPrice: "",
    description: "",
  });

  const [search, setSearch] = useState("");
  const [filterSport, setFilterSport] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await sportsPlanAPI.getAll();
      setPlans(r.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm({ name: "", sport: "", sessionsPerWeek: "0", monthlyPrice: "", yearlyPrice: "", description: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim() || !form.sport.trim() || !form.monthlyPrice || !form.yearlyPrice) {
      toast({ title: "Missing fields", description: "Name, sport and both prices are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        sport: form.sport,
        sessionsPerWeek: Number(form.sessionsPerWeek) || 0,
        monthlyPrice: Number(form.monthlyPrice),
        yearlyPrice: Number(form.yearlyPrice),
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
      monthlyPrice: String(p.monthlyPrice),
      yearlyPrice: String(p.yearlyPrice),
      description: p.description || "",
    });
    setShowForm(true);
  };

  const sportOptions = useMemo(
    () => Array.from(new Set(plans.map((p) => p.sport).filter(Boolean))).sort(),
    [plans],
  );

  const filtered = useMemo(() => {
    return plans.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sport.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterSport && p.sport !== filterSport) return false;
      return true;
    });
  }, [plans, search, filterSport]);

  const displayed = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "sport") cmp = a.sport.localeCompare(b.sport);
      else if (sortKey === "monthlyPrice") cmp = a.monthlyPrice - b.monthlyPrice;
      else if (sortKey === "sessionsPerWeek") cmp = a.sessionsPerWeek - b.sessionsPerWeek;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const avgMonthly = plans.length ? Math.round(plans.reduce((s, p) => s + p.monthlyPrice, 0) / plans.length) : 0;

  return (
    <AppLayout title="Coaching Plans">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="font-display font-bold text-2xl text-black">Coaching Plans</h1>
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Plans</p>
            <p className="text-2xl font-bold text-black">{plans.length}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00C48C]/10 border-2 border-[#00C48C] flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-[#00C48C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sports Covered</p>
            <p className="text-2xl font-bold text-black">{sportOptions.length}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Avg. Monthly Price</p>
            <p className="text-2xl font-bold text-black">₹{avgMonthly.toLocaleString("en-IN")}</p>
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
            <option key={s} value={s}>{s}</option>
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
          {sortDir === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          {sortDir === "asc" ? "Asc" : "Desc"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border-2 border-black p-6 mb-6">
          <h3 className="font-bold text-base mb-4">{editingId ? "Edit Plan" : "Add Plan"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Plan Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Tennis - 3x/week"
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Sport *</label>
              <input
                value={form.sport}
                onChange={(e) => setForm((p) => ({ ...p, sport: e.target.value }))}
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Sessions / Week (0 = unlimited)</label>
              <input
                type="number"
                value={form.sessionsPerWeek}
                onChange={(e) => setForm((p) => ({ ...p, sessionsPerWeek: e.target.value }))}
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div />
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Monthly Price (₹) *</label>
              <input
                type="number"
                value={form.monthlyPrice}
                onChange={(e) => setForm((p) => ({ ...p, monthlyPrice: e.target.value }))}
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Yearly Price (₹) *</label>
              <input
                type="number"
                value={form.yearlyPrice}
                onChange={(e) => setForm((p) => ({ ...p, yearlyPrice: e.target.value }))}
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase mb-1">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
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
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save
            </button>
            <button onClick={resetForm} className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-bold text-sm uppercase">
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
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
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
                    <button onClick={() => startEdit(p)} className="p-1.5 border border-black/10 hover:border-black">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(p._id)} className="p-1.5 border border-black/10 hover:border-red-500 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-2xl font-bold text-[#024BAB]">₹{p.monthlyPrice}<span className="text-xs text-muted-foreground font-medium">/mo</span></p>
                <p className="text-xs text-muted-foreground">₹{p.yearlyPrice}/year · {p.sessionsPerWeek === 0 ? "Unlimited" : `${p.sessionsPerWeek}x`}/week</p>
                {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block border-2 border-black bg-white overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-[#024BAB]/5">
                  {["Name", "Sport", "Sessions/Week", "Monthly", "Yearly", "Description", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((p, idx) => (
                  <tr key={p._id} className={cn("border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors", idx % 2 === 0 ? "" : "bg-[#F8FAFF]")}>
                    <td className="px-4 py-3 font-bold text-black">{p.name}</td>
                    <td className="px-4 py-3 text-black">{p.sport}</td>
                    <td className="px-4 py-3 text-black">{p.sessionsPerWeek === 0 ? "Unlimited" : `${p.sessionsPerWeek}x`}</td>
                    <td className="px-4 py-3 font-bold text-[#024BAB]">₹{p.monthlyPrice}</td>
                    <td className="px-4 py-3 text-black">₹{p.yearlyPrice}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{p.description || "—"}</td>
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
        </>
      )}
    </AppLayout>
  );
}
