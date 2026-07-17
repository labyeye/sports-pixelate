import { useState, useEffect, useCallback, useMemo } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { facilityAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  Search,
  ArrowUp,
  ArrowDown,
  Building2,
  Users2,
} from "lucide-react";

interface Facility {
  _id: string;
  name: string;
  type: string;
  sport: string;
  capacity: number;
  hourlyFee: number;
}

type SortKey = "name" | "type" | "capacity" | "hourlyFee";

export default function FacilitiesPage() {
  const { toast } = useToast();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "court",
    sport: "",
    capacity: "1",
    hourlyFee: "0",
  });

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSport, setFilterSport] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const facilityParams = useCallback(
    (pageNum: number): Record<string, string> => {
      const params: Record<string, string> = { page: String(pageNum), limit: "20" };
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      if (filterSport) params.sport = filterSport;
      params.sortBy = sortKey;
      params.sortDir = sortDir;
      return params;
    },
    [search, filterType, filterSport, sortKey, sortDir],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await facilityAPI.getAll(facilityParams(1));
      setFacilities(r.data);
      setPage(1);
      setPages(r.pages || 1);
      setTotal(r.total ?? r.data.length);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [facilityParams]);

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await facilityAPI.getAll(facilityParams(next));
      setFacilities((p) => [...p, ...r.data]);
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
      type: "court",
      sport: "",
      capacity: "1",
      hourlyFee: "0",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (f: Facility) => {
    setEditingId(f._id);
    setForm({
      name: f.name,
      type: f.type,
      sport: f.sport || "",
      capacity: String(f.capacity),
      hourlyFee: String(f.hourlyFee),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        capacity: Number(form.capacity) || 1,
        hourlyFee: Number(form.hourlyFee) || 0,
      };
      if (editingId) {
        const r = await facilityAPI.update(editingId, payload);
        setFacilities((p) => p.map((x) => (x._id === editingId ? r.data : x)));
        toast({ title: "Facility updated" });
      } else {
        const r = await facilityAPI.create(payload);
        setFacilities((p) => [...p, r.data]);
        toast({ title: "Facility added" });
      }
      resetForm();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deactivate this facility?")) return;
    try {
      await facilityAPI.delete(id);
      setFacilities((p) => p.filter((f) => f._id !== id));
      toast({ title: "Facility deactivated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const [sportOptions, setSportOptions] = useState<string[]>([]);
  useEffect(() => {
    facilityAPI
      .getAll({ limit: "200" })
      .then((r) =>
        setSportOptions(
          Array.from(
            new Set((r.data as Facility[]).map((f) => f.sport).filter(Boolean)),
          ).sort(),
        ),
      )
      .catch(() => {});
  }, []);

  const displayed = facilities;

  const totalCapacity = facilities.reduce((s, f) => s + (f.capacity || 0), 0);
  const freeCount = facilities.filter((f) => !f.hourlyFee).length;

  return (
    <AppLayout title="Facilities">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="font-display font-bold text-2xl text-black">
          Facilities
        </h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-[#01368A] transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Facility
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Facilities
            </p>
            <p className="text-2xl font-bold text-black">{total}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00C48C]/10 border-2 border-[#00C48C] flex items-center justify-center shrink-0">
            <Users2 className="w-5 h-5 text-[#00C48C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Capacity
            </p>
            <p className="text-2xl font-bold text-black">{totalCapacity}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Free to Book
            </p>
            <p className="text-2xl font-bold text-black">{freeCount}</p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0" />
          <input
            type="text"
            placeholder="Search by facility name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full font-medium"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Types</option>
          {["court", "pool", "turf", "gym", "equipment", "other"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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
        {(search || filterType || filterSport) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterType("");
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
          <option value="type">Sort: Type</option>
          <option value="capacity">Sort: Capacity</option>
          <option value="hourlyFee">Sort: Hourly Fee</option>
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
            {editingId ? "Edit Facility" : "Add Facility"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Name *
              </label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. Court 1"
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((p) => ({ ...p, type: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
              >
                {["court", "pool", "turf", "gym", "equipment", "other"].map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Sport
              </label>
              <input
                value={form.sport}
                onChange={(e) =>
                  setForm((p) => ({ ...p, sport: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Capacity
              </label>
              <input
                type="number"
                value={form.capacity}
                onChange={(e) =>
                  setForm((p) => ({ ...p, capacity: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Hourly Fee (₹, 0 = free)
              </label>
              <input
                type="number"
                value={form.hourlyFee}
                onChange={(e) =>
                  setForm((p) => ({ ...p, hourlyFee: e.target.value }))
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
          <MapPin className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No facilities found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {displayed.map((f) => (
              <div key={f._id} className="border-2 border-black bg-white p-4">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-bold text-black">{f.name}</p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(f)}
                      className="p-1 border border-black/10 hover:border-black"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(f._id)}
                      className="p-1 border border-black/10 hover:border-red-500 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground capitalize mb-2">
                  {f.type} {f.sport ? `· ${f.sport}` : ""}
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">Capacity: </span>
                    <span className="font-bold text-black">{f.capacity}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fee: </span>
                    <span className="font-bold text-[#024BAB]">
                      {f.hourlyFee > 0 ? `₹${f.hourlyFee}/hr` : "Free"}
                    </span>
                  </div>
                </div>
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
                    "Type",
                    "Sport",
                    "Capacity",
                    "Hourly Fee",
                    "Actions",
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
                {displayed.map((f, idx) => (
                  <tr
                    key={f._id}
                    className={cn(
                      "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                      idx % 2 === 0 ? "" : "bg-[#F8FAFF]",
                    )}
                  >
                    <td className="px-4 py-3 font-bold text-black">{f.name}</td>
                    <td className="px-4 py-3 text-black capitalize">
                      {f.type}
                    </td>
                    <td className="px-4 py-3 text-black">{f.sport || "—"}</td>
                    <td className="px-4 py-3 text-black">{f.capacity}</td>
                    <td className="px-4 py-3 font-bold text-[#024BAB]">
                      {f.hourlyFee > 0 ? `₹${f.hourlyFee}/hr` : "Free"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(f)}
                          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(f._id)}
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
                Showing {facilities.length} of {total}
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
    </AppLayout>
  );
}
