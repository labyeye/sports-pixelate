import { useCallback, useEffect, useState } from "react";
import {
  LogIn,
  LogOut,
  Clock,
  Smartphone,
  Monitor,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { auditAPI } from "@/services/api";

interface ActivityEvent {
  id: string;
  kind: "check_in" | "check_out" | "login" | "logout";
  at: string;
  name: string;
  sub?: string;
  via?: string;
  status?: string;
  device?: string;
  platform?: string;
  ip?: string;
  distance?: number;
  workHours?: number;
}

const KIND: Record<
  ActivityEvent["kind"],
  { label: string; cls: string; Icon: typeof LogIn }
> = {
  check_in: {
    label: "Checked in",
    cls: "bg-green-100 text-green-800 border-green-300",
    Icon: LogIn,
  },
  check_out: {
    label: "Checked out",
    cls: "bg-orange-100 text-orange-800 border-orange-300",
    Icon: LogOut,
  },
  login: {
    label: "Signed in",
    cls: "bg-blue-100 text-blue-800 border-blue-300",
    Icon: Monitor,
  },
  logout: {
    label: "Signed out",
    cls: "bg-gray-100 text-gray-700 border-gray-300",
    Icon: LogOut,
  },
};

const TYPES = [
  { key: "all", label: "Everything" },
  { key: "attendance", label: "Check in / out" },
  { key: "login", label: "Staff logins" },
];

const PAGE_SIZE = 25;
const today = () =>
  new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
const fmtDay = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const cap = (v?: string) =>
  v ? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";

export function ActivityTimeline() {
  const [type, setType] = useState("all");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ActivityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({
    checkIns: 0,
    checkOuts: 0,
    logins: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await auditAPI.getActivity({
        type,
        startDate,
        endDate,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      setRows(res.data || []);
      setTotal(res.total || 0);
      if (res.summary) setSummary(res.summary);
    } catch (e: any) {
      setError(e?.message || "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, [type, startDate, endDate, page]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="bg-white border-2 border-black p-4 flex flex-wrap items-center gap-3">
        <div className="flex border-2 border-black">
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setType(t.key);
                setPage(1);
              }}
              className={`px-3 py-2 text-xs font-bold ${type === t.key ? "bg-[#024BAB] text-white" : "bg-white text-gray-600"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={startDate}
          max={endDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
          className="border-2 border-black px-3 py-2 text-sm font-medium"
        />
        <span className="text-xs font-bold text-gray-500">to</span>
        <input
          type="date"
          value={endDate}
          min={startDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }}
          className="border-2 border-black px-3 py-2 text-sm font-medium"
        />
        <div className="flex gap-2 ml-auto text-xs font-bold">
          <span className="px-2 py-1 border-2 border-black bg-green-100">
            {summary.checkIns} in
          </span>
          <span className="px-2 py-1 border-2 border-black bg-orange-100">
            {summary.checkOuts} out
          </span>
          <span className="px-2 py-1 border-2 border-black bg-blue-100">
            {summary.logins} logins
          </span>
        </div>
      </div>

      <div className="bg-white border-2 border-black overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400 font-medium">
            Loading...
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-600 font-medium">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              No activity for this period
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-black bg-[#F0F6FF]">
                    {["Time", "Who", "Event", "How / Device", "Details"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const k = KIND[r.kind];
                    const isLogin = r.kind === "login" || r.kind === "logout";
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-gray-100 ${i % 2 ? "bg-gray-50/50" : ""}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-bold text-black text-xs">
                            {fmtTime(r.at)}
                          </div>
                          <div className="text-xs text-gray-400">
                            {fmtDay(r.at)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-black text-xs">
                            {r.name}
                          </div>
                          <div className="text-xs text-gray-400">{r.sub}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold border rounded-sm whitespace-nowrap ${k.cls}`}
                          >
                            <k.Icon className="w-3 h-3" />
                            {k.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700">
                          {isLogin ? (
                            <span className="inline-flex items-center gap-1">
                              {r.platform === "web" ? (
                                <Monitor className="w-3.5 h-3.5" />
                              ) : (
                                <Smartphone className="w-3.5 h-3.5" />
                              )}
                              {r.device || "Unknown device"}
                            </span>
                          ) : (
                            cap(r.via) || "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {isLogin
                            ? r.ip
                              ? `IP ${r.ip}`
                              : "—"
                            : [
                                cap(r.status),
                                r.kind === "check_out" && r.workHours
                                  ? `${r.workHours}h worked`
                                  : "",
                                r.distance != null
                                  ? `${Math.round(r.distance)}m from office`
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t-2 border-black bg-[#F0F6FF]">
                <span className="text-xs font-bold text-gray-600">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 px-3 py-1.5 border-2 border-black text-xs font-bold disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3 h-3" /> Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={page === pages}
                    className="flex items-center gap-1 px-3 py-1.5 border-2 border-black text-xs font-bold disabled:opacity-40"
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
