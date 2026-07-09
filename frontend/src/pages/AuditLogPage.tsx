import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { auditAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
} from "lucide-react";

interface AuditLog {
  _id: string;
  user?: { name: string; email: string; role: string };
  userName?: string;
  userEmail?: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, any>;
  ip?: string;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  employee_created: "bg-green-100 text-green-800 border-green-300",
  employee_updated: "bg-blue-100 text-blue-800 border-blue-300",
  employee_terminated: "bg-red-100 text-red-800 border-red-300",
  leave_approved: "bg-green-100 text-green-800 border-green-300",
  leave_rejected: "bg-red-100 text-red-800 border-red-300",
  leave_cancelled: "bg-gray-100 text-gray-700 border-gray-300",
  exit_initiated: "bg-orange-100 text-orange-800 border-orange-300",
  exit_updated: "bg-yellow-100 text-yellow-800 border-yellow-300",
};

function actionLabel(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmt(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PAGE_SIZE = 20;

export default function AuditLogPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(PAGE_SIZE),
      };
      if (search) params.action = search;
      if (entityFilter) params.entity = entityFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await auditAPI.getLogs(params);
      setLogs(res.data || []);
      setTotal(res.total || 0);
    } catch {
      toast({ title: "Failed to load audit logs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, search, entityFilter, startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center gap-2">
            <Shield className="w-6 h-6" /> Audit Log
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track who changed what and when across your organisation
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white border-2 border-black p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex border-2 border-black focus-within:border-[#024BAB] transition-colors">
              <span className="flex items-center px-3 bg-gray-50 border-r-2 border-black">
                <Search className="w-4 h-4 text-gray-500" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search actions..."
                className="flex-1 px-3 py-2 text-sm font-medium outline-none bg-white"
              />
            </div>

            <div className="flex border-2 border-black focus-within:border-[#024BAB] transition-colors">
              <span className="flex items-center px-3 bg-gray-50 border-r-2 border-black">
                <Filter className="w-4 h-4 text-gray-500" />
              </span>
              <select
                value={entityFilter}
                onChange={(e) => {
                  setEntityFilter(e.target.value);
                  setPage(1);
                }}
                className="flex-1 px-3 py-2 text-sm font-medium outline-none bg-white"
              >
                <option value="">All entities</option>
                <option value="Employee">Employee</option>
                <option value="Leave">Leave</option>
                <option value="ExitManagement">Exit Management</option>
              </select>
            </div>

            <div className="flex border-2 border-black focus-within:border-[#024BAB] transition-colors">
              <span className="flex items-center px-3 bg-gray-50 border-r-2 border-black">
                <Calendar className="w-4 h-4 text-gray-500" />
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="flex-1 px-3 py-2 text-sm font-medium outline-none bg-white"
              />
            </div>

            <div className="flex border-2 border-black focus-within:border-[#024BAB] transition-colors">
              <span className="flex items-center px-3 bg-gray-50 border-r-2 border-black">
                <Calendar className="w-4 h-4 text-gray-500" />
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="flex-1 px-3 py-2 text-sm font-medium outline-none bg-white"
              />
            </div>
          </div>
        </div>

        {/* Log table */}
        <div className="bg-white border-2 border-black overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-gray-400 font-medium">
              Loading...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No audit logs found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-black bg-[#F0F6FF]">
                      <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider">
                        User
                      </th>
                      <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider">
                        Action
                      </th>
                      <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider">
                        Entity
                      </th>
                      <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider">
                        IP
                      </th>
                      <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => (
                      <>
                        <tr
                          key={log._id}
                          className={`border-b border-gray-100 hover:bg-[#F0F6FF] transition-colors cursor-pointer ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}
                          onClick={() =>
                            setExpanded(expanded === log._id ? null : log._id)
                          }
                        >
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                            {fmt(log.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <div>
                                <div className="font-bold text-black text-xs">
                                  {log.user?.name || log.userName || "System"}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {log.user?.email || log.userEmail || ""}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 text-xs font-bold border rounded-sm whitespace-nowrap ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-700 border-gray-300"}`}
                            >
                              {actionLabel(log.action)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {log.entity || "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                            {log.ip || "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#024BAB] font-bold">
                            {log.details && Object.keys(log.details).length > 0
                              ? "View ▾"
                              : "—"}
                          </td>
                        </tr>
                        {expanded === log._id &&
                          log.details &&
                          Object.keys(log.details).length > 0 && (
                            <tr
                              key={`${log._id}-detail`}
                              className="bg-[#F0F6FF] border-b border-gray-200"
                            >
                              <td colSpan={6} className="px-6 py-3">
                                <div className="flex flex-wrap gap-3">
                                  {Object.entries(log.details).map(([k, v]) => (
                                    <div
                                      key={k}
                                      className="bg-white border border-gray-300 px-3 py-1.5 rounded-sm"
                                    >
                                      <span className="text-xs text-gray-500 font-bold uppercase">
                                        {k}:{" "}
                                      </span>
                                      <span className="text-xs font-bold text-black">
                                        {String(v)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t-2 border-black bg-[#F0F6FF]">
                  <span className="text-xs font-bold text-gray-600">
                    Showing {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, total)} of {total}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="flex items-center gap-1 px-3 py-1.5 border-2 border-black text-xs font-bold disabled:opacity-40 hover:bg-white transition-colors"
                    >
                      <ChevronLeft className="w-3 h-3" /> Prev
                    </button>
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="flex items-center gap-1 px-3 py-1.5 border-2 border-black text-xs font-bold disabled:opacity-40 hover:bg-white transition-colors"
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
    </AppLayout>
  );
}
