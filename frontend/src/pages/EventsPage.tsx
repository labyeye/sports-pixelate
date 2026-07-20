import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { eventAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { eventTypes } from "@/config/eventTypeConfig";
import {
  EventForm,
  type EventFormPayload,
  type StagedOfficial,
} from "@/components/events/EventForm";
import {
  Trophy,
  Plus,
  X,
  Loader2,
  Search,
  ArrowUp,
  ArrowDown,
  PlayCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import type { Event } from "@/types/hrms";

type SortKey = "name" | "startDate" | "createdAt";

const STATUS_META: Record<Event["status"], { bg: string; text: string }> = {
  draft: { bg: "bg-gray-50", text: "text-gray-500" },
  registration_open: { bg: "bg-[#00C48C]/10", text: "text-[#00C48C]" },
  registration_closed: { bg: "bg-[#FBBF24]/10", text: "text-[#FBBF24]" },
  upcoming: { bg: "bg-[#024BAB]/10", text: "text-[#024BAB]" },
  live: { bg: "bg-[#EF4444]/10", text: "text-[#EF4444]" },
  completed: { bg: "bg-gray-100", text: "text-gray-600" },
  cancelled: { bg: "bg-gray-100", text: "text-gray-400" },
};

export default function EventsPage() {
  const { user } = useAuth();
  const isParent = user?.role === "parent";
  const { toast } = useToast();
  const navigate = useNavigate();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [filterEventType, setFilterEventType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const buildParams = useCallback(
    (pageNum: number): Record<string, string> => {
      const params: Record<string, string> = {
        page: String(pageNum),
        limit: "21",
      };
      if (search) params.search = search;
      if (filterEventType) params.eventType = filterEventType;
      if (filterStatus) params.status = filterStatus;
      params.sortBy = sortKey;
      params.sortDir = sortDir;
      return params;
    },
    [search, filterEventType, filterStatus, sortKey, sortDir],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await eventAPI.getAll(buildParams(1));
      setEvents(r.data);
      setPage(1);
      setPages(r.pages || 1);
      setTotal(r.total ?? r.data.length);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await eventAPI.getAll(buildParams(next));
      setEvents((p) => [...p, ...r.data]);
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

  const handleCreate = async (
    payload: EventFormPayload,
    files: { coverImage?: File; bannerImage?: File },
    stagedOfficials: StagedOfficial[],
  ) => {
    setCreating(true);
    try {
      const res = await eventAPI.create(payload);
      const id = res.data._id;
      if (files.coverImage || files.bannerImage) {
        await eventAPI.uploadImages(id, files);
      }
      for (const official of stagedOfficials) {
        await eventAPI.addOfficial(id, official);
      }
      toast({
        title: "Event created",
        description: `"${payload.name}" is ready.`,
      });
      setShowCreateModal(false);
      navigate(`/events/${id}`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout title="Events">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="font-display font-bold text-2xl text-black">Events</h1>
        {!isParent && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-[#01368A] transition-colors"
          >
            <Plus className="w-4 h-4" /> New Event
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Events
            </p>
            <p className="text-2xl font-bold text-black">{total}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00C48C]/10 border-2 border-[#00C48C] flex items-center justify-center shrink-0">
            <PlayCircle className="w-5 h-5 text-[#00C48C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Upcoming / Live
            </p>
            <p className="text-2xl font-bold text-black">
              {
                events.filter(
                  (e) => e.status === "upcoming" || e.status === "live",
                ).length
              }
            </p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#A855F7]/10 border-2 border-[#A855F7] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-[#A855F7]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Completed
            </p>
            <p className="text-2xl font-bold text-black">
              {events.filter((e) => e.status === "completed").length}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0" />
          <input
            type="text"
            placeholder="Search by event name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full font-medium"
          />
        </div>
        <select
          value={filterEventType}
          onChange={(e) => setFilterEventType(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Types</option>
          {Object.entries(eventTypes).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Status</option>
          {[
            "draft",
            "registration_open",
            "registration_closed",
            "upcoming",
            "live",
            "completed",
            "cancelled",
          ].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        {(search || filterEventType || filterStatus) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterEventType("");
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
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="border-2 border-black bg-white p-10 text-center">
          <Trophy className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-bold">No events found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your filters, or create a new event.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {events.map((event) => {
            const meta = STATUS_META[event.status];
            return (
              <button
                key={event._id}
                onClick={() => navigate(`/events/${event._id}`)}
                className="text-left border-2 border-black bg-white p-4 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 ${meta.bg} ${meta.text}`}
                  >
                    {event.status.replace(/_/g, " ")}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
                <h3 className="font-bold text-sm">{event.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {eventTypes[event.eventType as keyof typeof eventTypes]
                    ?.label || event.eventType}{" "}
                  · {event.activity}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {event.registrationCount ?? event.registrations?.length ?? 0}{" "}
                  registered
                  {event.teams?.length ? ` · ${event.teams.length} teams` : ""}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {!loading && page < pages && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="border-2 border-black bg-white px-4 py-2 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{" "}
            Load more
          </button>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-2 border-b-0 border-black bg-[#024BAB]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-lg text-white">Create Event</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-white hover:text-white/70 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <EventForm
              mode="create"
              onSubmit={handleCreate}
              onCancel={() => setShowCreateModal(false)}
              saving={creating}
            />
          </div>
        </div>
      )}
    </AppLayout>
  );
}
