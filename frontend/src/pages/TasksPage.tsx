// Tasks (web): owners assign tasks to staff; staff move their own tasks through
// pending → in progress → completed and comment. Overdue tasks are flagged
// "late" by the server. Backend: taskAPI.

import { useState, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { taskAPI, employeeAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { confirmDialog } from "@/lib/confirmDialog";
import {
  ListChecks,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  MessageSquare,
  X,
} from "lucide-react";

type Status = "pending" | "in_progress" | "completed";
type Priority = "low" | "medium" | "high";

interface Person {
  _id: string;
  name: string;
  email?: string;
}
interface Task {
  _id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: Status;
  dueDate?: string;
  late?: boolean;
  assignedTo: Person;
  assignedBy: Person;
  comments?: { _id: string; user: Person; message: string; createdAt: string }[];
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-gray-100 border-gray-400 text-gray-700" },
  in_progress: {
    label: "In Progress",
    cls: "bg-blue-50 border-[#024BAB] text-[#024BAB]",
  },
  completed: {
    label: "Completed",
    cls: "bg-green-50 border-[#00C48C] text-[#00875f]",
  },
};
const PRIORITY_CLS: Record<Priority, string> = {
  low: "bg-gray-100 border-gray-400 text-gray-700",
  medium: "bg-orange-50 border-[#FA731C] text-[#c2570f]",
  high: "bg-red-50 border-red-500 text-red-700",
};
const FILTERS: { key: "" | Status; label: string }[] = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

const fmt = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "No due date";

const EMPTY = {
  title: "",
  description: "",
  assignedTo: "",
  priority: "medium" as Priority,
  dueDate: "",
};

export default function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canAssign =
    user?.role === "super_admin" ||
    user?.role === "hr_manager" ||
    (user?.role as string) === "department_head";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"" | Status>("");
  const [open, setOpen] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState("");

  const fail = (e: unknown) =>
    toast({
      title: "Error",
      description: getErrorMessage(e),
      variant: "destructive",
    });

  const load = useCallback(async () => {
    try {
      const r = await taskAPI.getAll();
      setTasks(r.data || []);
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAssign) return;
    employeeAPI
      .getAll({ limit: "200" })
      .then((r: any) =>
        setStaff(
          (r.data || [])
            .filter((e: any) => e.user)
            .map((e: any) => ({
              id: String(e.user?._id || e.user),
              name: `${e.firstName || ""} ${e.lastName || ""}`.trim(),
            })),
        ),
      )
      .catch(() => {});
  }, [canAssign]);

  const shown = useMemo(
    () => (filter ? tasks.filter((t) => t.status === filter) : tasks),
    [tasks, filter],
  );
  const count = (s: Status) => tasks.filter((t) => t.status === s).length;
  const lateCount = tasks.filter((t) => t.late && t.status !== "completed")
    .length;

  const replace = (t: Task) => {
    setTasks((p) => p.map((x) => (x._id === t._id ? { ...x, ...t } : x)));
    setOpen((o) => (o && o._id === t._id ? { ...o, ...t } : o));
  };

  const changeStatus = async (t: Task, status: Status) => {
    try {
      const r = await taskAPI.updateStatus(t._id, status);
      replace(r.data);
    } catch (e) {
      fail(e);
    }
  };

  const save = async () => {
    if (saving) return;
    if (!form.title.trim() || !form.assignedTo) {
      toast({
        title: "Required",
        description: "Title and assignee are required",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await taskAPI.create({ ...form, dueDate: form.dueDate || undefined });
      toast({ title: "Task assigned" });
      setShowForm(false);
      setForm(EMPTY);
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: Task) => {
    if (!(await confirmDialog(`Delete "${t.title}"?`))) return;
    try {
      await taskAPI.delete(t._id);
      setTasks((p) => p.filter((x) => x._id !== t._id));
      setOpen(null);
      toast({ title: "Task moved to trash" });
    } catch (e) {
      fail(e);
    }
  };

  const openTask = async (t: Task) => {
    setOpen(t);
    setComment("");
    try {
      const r = await taskAPI.getOne(t._id);
      setOpen(r.data);
    } catch {
      /* keep the list copy */
    }
  };

  const sendComment = async () => {
    if (!open || !comment.trim()) return;
    try {
      const r = await taskAPI.addComment(open._id, comment.trim());
      setOpen({ ...open, comments: r.data.comments });
      setComment("");
    } catch (e) {
      fail(e);
    }
  };

  const tiles = [
    { label: "Total", value: tasks.length, icon: ListChecks, c: "#024BAB" },
    { label: "Pending", value: count("pending"), icon: Clock, c: "#FA731C" },
    {
      label: "In Progress",
      value: count("in_progress"),
      icon: Loader2,
      c: "#7C3AED",
    },
    {
      label: "Completed",
      value: count("completed"),
      icon: CheckCircle2,
      c: "#00C48C",
    },
  ];

  return (
    <AppLayout title="Tasks">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-3">
          <div>
            <h1 className="font-display font-bold text-3xl text-black">Tasks</h1>
            <p className="text-gray-600 font-medium mt-1">
              {canAssign
                ? "Assign work to your staff and track it to completion"
                : "Your assigned tasks"}
              {lateCount > 0 && (
                <span className="ml-2 text-red-600 font-bold">
                  · {lateCount} overdue
                </span>
              )}
            </p>
          </div>
          {canAssign && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase shrink-0"
            >
              <Plus className="w-4 h-4" /> New Task
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="border-2 border-black bg-white p-4 flex items-center gap-3"
            >
              <div
                className="w-10 h-10 border-2 flex items-center justify-center shrink-0"
                style={{ borderColor: t.c, background: `${t.c}1A` }}
              >
                <t.icon className="w-5 h-5" style={{ color: t.c }} />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {t.label}
                </p>
                <p className="text-2xl font-bold text-black">{t.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 border-2 border-black text-xs font-bold uppercase",
                filter === f.key ? "bg-black text-white" : "bg-white",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : shown.length === 0 ? (
          <div className="border-2 border-black bg-white p-10 text-center">
            <ListChecks className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="font-bold">No tasks</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shown.map((t) => (
              <div
                key={t._id}
                onClick={() => openTask(t)}
                className="border-2 border-black bg-white p-4 cursor-pointer hover:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-black truncate">{t.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {canAssign ? `To ${t.assignedTo?.name} · ` : ""}
                      Due {fmt(t.dueDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                    {t.late && t.status !== "completed" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold uppercase border bg-red-50 border-red-500 text-red-700">
                        <AlertTriangle className="w-3 h-3" /> Late
                      </span>
                    )}
                    <span
                      className={cn(
                        "px-2 py-0.5 text-xs font-bold uppercase border",
                        PRIORITY_CLS[t.priority],
                      )}
                    >
                      {t.priority}
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 text-xs font-bold uppercase border",
                        STATUS_META[t.status].cls,
                      )}
                    >
                      {STATUS_META[t.status].label}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="nb-backdrop fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="nb-modal border-2 border-black bg-white w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">New Task</h2>
              <button onClick={() => setShowForm(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              className="w-full border-2 border-black px-3 py-2 text-sm"
              placeholder="Title"
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <textarea
              className="w-full border-2 border-black px-3 py-2 text-sm"
              placeholder="Description (optional)"
              rows={3}
              maxLength={2000}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <select
              className="w-full border-2 border-black px-3 py-2 text-sm bg-white"
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            >
              <option value="">Assign to…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <select
                className="border-2 border-black px-3 py-2 text-sm bg-white"
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value as Priority })
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                type="date"
                className="border-2 border-black px-3 py-2 text-sm"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="w-full bg-[#024BAB] text-white border-2 border-black py-2 font-bold uppercase text-sm disabled:opacity-60"
            >
              {saving ? "Saving…" : "Assign Task"}
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="nb-backdrop fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="nb-modal border-2 border-black bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-bold text-lg">{open.title}</h2>
              <button onClick={() => setOpen(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            {open.description && (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {open.description}
              </p>
            )}
            <p className="text-xs text-gray-600">
              Assigned to {open.assignedTo?.name} by {open.assignedBy?.name} ·
              Due {fmt(open.dueDate)}
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_META) as Status[]).map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(open, s)}
                  className={cn(
                    "px-3 py-1.5 border-2 text-xs font-bold uppercase",
                    open.status === s
                      ? "bg-black text-white border-black"
                      : "bg-white border-black",
                  )}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
            <div className="border-t-2 border-black pt-3">
              <p className="text-xs font-bold uppercase mb-2 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" /> Comments
              </p>
              <div className="space-y-2 mb-2">
                {(open.comments || []).map((c) => (
                  <div key={c._id} className="text-sm bg-gray-50 p-2 border">
                    <span className="font-bold">{c.user?.name}: </span>
                    {c.message}
                  </div>
                ))}
                {!open.comments?.length && (
                  <p className="text-xs text-gray-500">No comments yet</p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 border-2 border-black px-3 py-2 text-sm"
                  placeholder="Add a comment…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendComment()}
                />
                <button
                  onClick={sendComment}
                  className="px-3 border-2 border-black bg-[#024BAB] text-white text-xs font-bold uppercase"
                >
                  Send
                </button>
              </div>
            </div>
            {canAssign && (
              <button
                onClick={() => remove(open)}
                className="flex items-center gap-1.5 text-red-600 text-xs font-bold uppercase"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete task
              </button>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
