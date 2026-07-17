import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { tournamentAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Plus,
  Check,
  X,
  Loader2,
  Users,
  ChevronRight,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface Tournament {
  _id: string;
  name: string;
  sport: string;
  format: "knockout" | "round_robin";
  startDate?: string;
  endDate?: string;
  venue?: string;
  teams: { _id: string; name: string }[];
  status: "draft" | "upcoming" | "ongoing" | "completed";
  fixturesGenerated: boolean;
  registrationCount?: number;
}

const STATUS_META: Record<Tournament["status"], { bg: string; text: string }> =
  {
    draft: { bg: "bg-gray-50", text: "text-gray-500" },
    upcoming: { bg: "bg-[#024BAB]/10", text: "text-[#024BAB]" },
    ongoing: { bg: "bg-[#00C48C]/10", text: "text-[#00C48C]" },
    completed: { bg: "bg-gray-100", text: "text-gray-600" },
  };

type SortKey = "name" | "startDate" | "createdAt";

export default function TournamentsPage() {
  const { user } = useAuth();
  const isParent = user?.role === "parent";
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sport: "",
    format: "knockout" as "knockout" | "round_robin",
    startDate: "",
    endDate: "",
    venue: "",
  });

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const tourneyParams = useCallback(
    (pageNum: number): Record<string, string> => {
      const params: Record<string, string> = { page: String(pageNum), limit: "21" };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      params.sortBy = sortKey;
      params.sortDir = sortDir;
      return params;
    },
    [search, filterStatus, sortKey, sortDir],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await tournamentAPI.getAll(tourneyParams(1));
      setTournaments(r.data);
      setPage(1);
      setPages(r.pages || 1);
      setTotal(r.total ?? r.data.length);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tourneyParams]);

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await tournamentAPI.getAll(tourneyParams(next));
      setTournaments((p) => [...p, ...r.data]);
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
      format: "knockout",
      startDate: "",
      endDate: "",
      venue: "",
    });
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (saving) return;
    if (!form.name.trim() || !form.sport.trim()) {
      toast({
        title: "Missing fields",
        description: "Name and sport are required",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const r = await tournamentAPI.create(form);
      setTournaments((p) => [r.data, ...p]);
      toast({ title: "Tournament created" });
      resetForm();
      navigate(`/tournaments/${r.data._id}`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Tournaments">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="font-display font-bold text-2xl text-black">
          Tournaments
        </h1>
        {!isParent && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-[#01368A] transition-colors"
          >
            <Plus className="w-4 h-4" /> New Tournament
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0" />
          <input
            type="text"
            placeholder="Search by tournament name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full font-medium"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Status</option>
          {["draft", "upcoming", "ongoing", "completed"].map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        {(search || filterStatus) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterStatus("");
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
          <option value="createdAt">Sort: Date Added</option>
          <option value="name">Sort: Name</option>
          <option value="startDate">Sort: Start Date</option>
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

      {!isParent && showForm && (
        <div className="bg-white border-2 border-black p-6 mb-6">
          <h3 className="font-bold text-base mb-4">New Tournament</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Tournament Name *
              </label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. Summer Football Cup"
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
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
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Format
              </label>
              <select
                value={form.format}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    format: e.target.value as "knockout" | "round_robin",
                  }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-semibold outline-none"
              >
                <option value="knockout">Knockout (Single Elimination)</option>
                <option value="round_robin">
                  Round Robin (Everyone plays everyone)
                </option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Venue
              </label>
              <input
                value={form.venue}
                onChange={(e) =>
                  setForm((p) => ({ ...p, venue: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, startDate: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-semibold outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                End Date
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, endDate: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-semibold outline-none"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Add teams and generate fixtures from the tournament page after
            creating it.
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Create
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
      ) : tournaments.length === 0 ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <Trophy className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No tournaments yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create one to start building fixtures
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tournaments.map((t) => {
            const meta = STATUS_META[t.status];
            return (
              <button
                key={t._id}
                onClick={() => navigate(`/tournaments/${t._id}`)}
                className="text-left border-2 border-black bg-white p-4 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-9 h-9 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
                    <Trophy className="w-4 h-4 text-[#024BAB]" />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase px-2 py-1 border-2 border-black",
                      meta.bg,
                      meta.text,
                    )}
                  >
                    {t.status.replace("_", " ")}
                  </span>
                </div>
                <p className="font-bold text-black">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.sport} ·{" "}
                  {t.format === "knockout" ? "Knockout" : "Round Robin"}
                </p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/10">
                  <span className="text-xs font-bold text-black flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {isParent
                      ? `${t.registrationCount || 0} registered`
                      : `${t.teams.length} team${t.teams.length === 1 ? "" : "s"}`}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {page < pages && (
        <div className="flex flex-col items-center gap-2 mt-4">
          <p className="text-xs text-muted-foreground">
            Showing {tournaments.length} of {total}
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
    </AppLayout>
  );
}
