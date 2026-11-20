// Make-up classes (web): reschedule a class a student missed, notify parents,
// then mark it attended / missed. Backend: makeupAPI (/api/makeup-classes).

import { useState, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { makeupAPI, studentAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { confirmDialog } from "@/lib/confirmDialog";
import { CalendarClock, Plus, Trash2, Loader2, X } from "lucide-react";

type Status = "scheduled" | "completed" | "missed" | "cancelled";
interface Makeup {
  _id: string;
  student?: { _id: string; firstName: string; lastName: string };
  sport?: string;
  batch?: string;
  missedDate?: string;
  scheduledDate: string;
  startTime?: string;
  status: Status;
  note?: string;
}
interface StudentLite {
  _id: string;
  firstName: string;
  lastName: string;
  sport?: string;
  batch?: string;
}

const META: Record<Status, { label: string; cls: string }> = {
  scheduled: { label: "Scheduled", cls: "bg-blue-50 border-[#024BAB] text-[#024BAB]" },
  completed: { label: "Attended", cls: "bg-green-50 border-[#00C48C] text-[#00875f]" },
  missed: { label: "Missed", cls: "bg-red-50 border-red-500 text-red-700" },
  cancelled: { label: "Cancelled", cls: "bg-gray-100 border-gray-400 text-gray-700" },
};
const FILTERS: { key: "" | Status; label: string }[] = [
  { key: "", label: "All" },
  ...(Object.keys(META) as Status[]).map((k) => ({ key: k, label: META[k].label })),
];
const fmt = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const EMPTY = { student: "", missedDate: "", scheduledDate: "", startTime: "", batch: "", note: "" };

export default function MakeupClassesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Makeup[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"" | Status>("");
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  const fail = (e: unknown) =>
    toast({ title: "Error", description: getErrorMessage(e), variant: "destructive" });

  const load = useCallback(async () => {
    try {
      const r = await makeupAPI.getAll();
      setItems(r.data || []);
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

  const openForm = async () => {
    setForm(EMPTY);
    setQ("");
    if (!students.length) {
      try {
        const r = await studentAPI.getAll({ limit: "500" });
        setStudents(r.data || []);
      } catch (e) {
        fail(e);
      }
    }
  };

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return students
      .filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(t))
      .slice(0, 6);
  }, [q, students]);
  const picked = students.find((s) => s._id === form?.student);

  const save = async () => {
    if (!form || saving) return;
    if (!form.student || !form.scheduledDate) {
      toast({ title: "Pick a student and a make-up date", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await makeupAPI.create({
        ...form,
        missedDate: form.missedDate || undefined,
        startTime: form.startTime || undefined,
      });
      toast({ title: "Make-up class scheduled", description: "Parents have been notified." });
      setForm(null);
      load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (m: Makeup, status: Status) => {
    try {
      const r = await makeupAPI.update(m._id, { status });
      setItems((p) => p.map((x) => (x._id === m._id ? { ...x, ...r.data } : x)));
    } catch (e) {
      fail(e);
    }
  };

  const remove = async (m: Makeup) => {
    if (!(await confirmDialog("Delete this make-up class?"))) return;
    try {
      await makeupAPI.delete(m._id);
      setItems((p) => p.filter((x) => x._id !== m._id));
    } catch (e) {
      fail(e);
    }
  };

  const shown = filter ? items.filter((i) => i.status === filter) : items;
  const inp = "w-full border-2 border-black px-3 py-2 text-sm";

  return (
    <AppLayout title="Make-up Classes">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-3">
          <div>
            <h1 className="font-display font-bold text-3xl text-black">Make-up Classes</h1>
            <p className="text-gray-600 font-medium mt-1">
              Give students a replacement session for classes they missed
            </p>
          </div>
          <button
            onClick={openForm}
            className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase shrink-0"
          >
            <Plus className="w-4 h-4" /> Schedule
          </button>
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
            <CalendarClock className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="font-bold">No make-up classes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shown.map((m) => (
              <div key={m._id} className="border-2 border-black bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold truncate">
                      {m.student?.firstName} {m.student?.lastName}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {fmt(m.scheduledDate)}
                      {m.startTime ? ` at ${m.startTime}` : ""}
                      {m.batch ? ` · ${m.batch}` : ""}
                      {m.sport ? ` · ${m.sport}` : ""}
                    </p>
                    {m.missedDate && (
                      <p className="text-xs text-gray-500">Missed on {fmt(m.missedDate)}</p>
                    )}
                    {m.note && <p className="text-xs text-gray-700 mt-1">{m.note}</p>}
                  </div>
                  <span className={cn("px-2 py-0.5 text-xs font-bold uppercase border shrink-0", META[m.status].cls)}>
                    {META[m.status].label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {m.status === "scheduled" && (
                    <>
                      <button onClick={() => setStatus(m, "completed")} className="px-3 py-1 border-2 border-black text-xs font-bold uppercase bg-[#00C48C]">
                        Attended
                      </button>
                      <button onClick={() => setStatus(m, "missed")} className="px-3 py-1 border-2 border-black text-xs font-bold uppercase">
                        Missed
                      </button>
                      <button onClick={() => setStatus(m, "cancelled")} className="px-3 py-1 border-2 border-black text-xs font-bold uppercase">
                        Cancel
                      </button>
                    </>
                  )}
                  <button onClick={() => remove(m)} className="ml-auto text-red-600" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {form && (
        <div className="nb-backdrop fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="nb-modal border-2 border-black bg-white w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Schedule make-up class</h2>
              <button onClick={() => setForm(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            {picked ? (
              <div className="flex items-center justify-between border-2 border-black px-3 py-2 text-sm">
                <span className="font-bold">
                  {picked.firstName} {picked.lastName}
                  {picked.batch ? ` · ${picked.batch}` : ""}
                </span>
                <button className="text-xs underline" onClick={() => setForm({ ...form, student: "" })}>
                  Change
                </button>
              </div>
            ) : (
              <div>
                <input className={inp} placeholder="Search student…" value={q} onChange={(e) => setQ(e.target.value)} />
                {matches.map((s) => (
                  <button
                    key={s._id}
                    onClick={() => setForm({ ...form, student: s._id, batch: s.batch || "" })}
                    className="block w-full text-left px-3 py-2 border-2 border-t-0 border-black text-sm hover:bg-gray-50"
                  >
                    {s.firstName} {s.lastName}
                    <span className="text-gray-500"> · {s.sport} {s.batch}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold uppercase">
                Missed on
                <input type="date" className={cn(inp, "mt-1 font-normal")} value={form.missedDate} onChange={(e) => setForm({ ...form, missedDate: e.target.value })} />
              </label>
              <label className="text-xs font-bold uppercase">
                Make-up date *
                <input type="date" className={cn(inp, "mt-1 font-normal")} value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="time" className={inp} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              <input className={inp} placeholder="Batch to attend" value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} />
            </div>
            <textarea className={inp} rows={2} maxLength={300} placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <button
              onClick={save}
              disabled={saving}
              className="w-full bg-[#024BAB] text-white border-2 border-black py-2 font-bold uppercase text-sm disabled:opacity-60"
            >
              {saving ? "Saving…" : "Schedule & notify parents"}
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
