// Enquiries (web): admission pipeline — log an enquiry, schedule a trial,
// follow up, waitlist, then convert into a Student (or mark lost with a
// reason). Backend: leadAPI (/api/leads).

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { leadAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { confirmDialog } from "@/lib/confirmDialog";
import {
  UserPlus,
  Plus,
  Trash2,
  Loader2,
  X,
  Phone,
  MessageCircle,
  AlertTriangle,
  CalendarClock,
  Search,
} from "lucide-react";

type Status =
  | "new"
  | "contacted"
  | "trial_scheduled"
  | "trial_done"
  | "waitlisted"
  | "converted"
  | "lost";

interface Lead {
  _id: string;
  childName: string;
  age?: number;
  guardianName?: string;
  phone: string;
  email?: string;
  sport?: string;
  batch?: string;
  source: string;
  status: Status;
  trialDate?: string;
  followUpDate?: string;
  lostReason?: string;
  createdAt: string;
  notes?: { _id: string; text: string; at: string }[];
}
interface Summary {
  total: number;
  byStatus: Record<string, number>;
  overdueFollowUps: number;
  conversionRate: number;
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-blue-50 border-[#024BAB] text-[#024BAB]" },
  contacted: {
    label: "Contacted",
    cls: "bg-gray-100 border-gray-400 text-gray-700",
  },
  trial_scheduled: {
    label: "Trial Booked",
    cls: "bg-purple-50 border-purple-500 text-purple-700",
  },
  trial_done: {
    label: "Trial Done",
    cls: "bg-orange-50 border-[#FA731C] text-[#c2570f]",
  },
  waitlisted: {
    label: "Waitlist",
    cls: "bg-yellow-50 border-yellow-500 text-yellow-700",
  },
  converted: {
    label: "Joined",
    cls: "bg-green-50 border-[#00C48C] text-[#00875f]",
  },
  lost: { label: "Lost", cls: "bg-red-50 border-red-500 text-red-700" },
};
const FILTERS: { key: "" | Status; label: string }[] = [
  { key: "", label: "All" },
  ...(Object.keys(STATUS_META) as Status[]).map((k) => ({
    key: k,
    label: STATUS_META[k].label,
  })),
];
const SOURCES = [
  "walk_in",
  "phone",
  "referral",
  "instagram",
  "facebook",
  "website",
  "hoarding",
  "other",
];
const label = (s: string) =>
  s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const fmt = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const dateInput = (d?: string) => (d ? d.slice(0, 10) : "");
const waLink = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length === 10 ? "91" + digits : digits}`;
};
const isOverdue = (l: Lead) =>
  !!l.followUpDate &&
  l.status !== "converted" &&
  l.status !== "lost" &&
  new Date(l.followUpDate) < new Date(new Date().toDateString());

const EMPTY = {
  childName: "",
  age: "",
  guardianName: "",
  phone: "",
  email: "",
  sport: "",
  batch: "",
  source: "walk_in",
  followUpDate: "",
};

export default function LeadsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwner = user?.role === "super_admin" || user?.role === "hr_manager";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"" | Status>("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<Lead | null>(null);
  const [note, setNote] = useState("");
  const [trial, setTrial] = useState("");
  const [follow, setFollow] = useState("");

  const fail = (e: unknown) =>
    toast({
      title: "Error",
      description: getErrorMessage(e),
      variant: "destructive",
    });

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filter) params.status = filter;
      if (search.trim()) params.search = search.trim();
      const r = await leadAPI.getAll(params);
      setLeads(r.data || []);
      setSummary(r.summary || null);
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const patch = (l: Lead) => {
    setLeads((p) => p.map((x) => (x._id === l._id ? { ...x, ...l } : x)));
    setOpen((o) => (o && o._id === l._id ? { ...o, ...l } : o));
  };

  const openLead = (l: Lead) => {
    setOpen(l);
    setNote("");
    setTrial(dateInput(l.trialDate));
    setFollow(dateInput(l.followUpDate));
  };

  const saveForm = async () => {
    if (!form || saving) return;
    if (!form.childName.trim() || !form.phone.trim()) {
      toast({
        title: "Required",
        description: "Child name and phone are required",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        age: form.age === "" ? undefined : Number(form.age),
        followUpDate: form.followUpDate || undefined,
      };
      if (editId) await leadAPI.update(editId, body);
      else await leadAPI.create(body);
      toast({ title: editId ? "Enquiry updated" : "Enquiry added" });
      setForm(null);
      setEditId(null);
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (l: Lead, status: Status) => {
    let extra: Record<string, unknown> = {};
    if (status === "trial_scheduled") {
      if (!trial) {
        toast({
          title: "Pick a trial date first",
          variant: "destructive",
        });
        return;
      }
      extra.trialDate = trial;
    }
    if (status === "lost") {
      const reason = window.prompt("Why was this enquiry lost? (optional)");
      if (reason === null) return;
      extra.lostReason = reason;
    }
    try {
      const r = await leadAPI.updateStatus(l._id, { status, ...extra });
      patch(r.data);
      load();
    } catch (e) {
      fail(e);
    }
  };

  const saveFollowUp = async () => {
    if (!open) return;
    try {
      const r = await leadAPI.updateStatus(open._id, {
        status: open.status,
        followUpDate: follow || "",
      });
      patch(r.data);
      toast({ title: follow ? "Follow-up set" : "Follow-up cleared" });
      load();
    } catch (e) {
      fail(e);
    }
  };

  const convert = async (l: Lead) => {
    let sport = l.sport || "";
    if (!sport) {
      sport = (window.prompt("Which sport is the student joining?") || "").trim();
      if (!sport) return;
    }
    if (
      !(await confirmDialog(
        `Enrol ${l.childName} as a student? By continuing you confirm the parent/guardian agreed to the Terms & Privacy Policy and to storing the child's data.`,
      ))
    )
      return;
    try {
      await leadAPI.convert(l._id, { sport, guardianConsent: true });
      toast({
        title: "Student enrolled",
        description: "Add a plan from Subscriptions to start billing.",
      });
      setOpen(null);
      load();
    } catch (e) {
      fail(e);
    }
  };

  const sendNote = async () => {
    if (!open || !note.trim()) return;
    try {
      const r = await leadAPI.addNote(open._id, note.trim());
      patch(r.data);
      setNote("");
    } catch (e) {
      fail(e);
    }
  };

  const remove = async (l: Lead) => {
    if (!(await confirmDialog(`Delete enquiry for ${l.childName}?`))) return;
    try {
      await leadAPI.delete(l._id);
      setOpen(null);
      load();
    } catch (e) {
      fail(e);
    }
  };

  const inp = "w-full border-2 border-black px-3 py-2 text-sm";
  const tiles = [
    { label: "Total", value: summary?.total ?? 0 },
    { label: "New", value: summary?.byStatus?.new ?? 0 },
    { label: "Trials Booked", value: summary?.byStatus?.trial_scheduled ?? 0 },
    { label: "Conversion", value: `${summary?.conversionRate ?? 0}%` },
  ];

  return (
    <AppLayout title="Enquiries">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-3">
          <div>
            <h1 className="font-display font-bold text-3xl text-black">
              Enquiries
            </h1>
            <p className="text-gray-600 font-medium mt-1">
              Track admissions from first call to first class
              {!!summary?.overdueFollowUps && (
                <span className="ml-2 text-red-600 font-bold">
                  · {summary.overdueFollowUps} follow-up
                  {summary.overdueFollowUps > 1 ? "s" : ""} overdue
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => {
              setEditId(null);
              setForm(EMPTY);
            }}
            className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase shrink-0"
          >
            <Plus className="w-4 h-4" /> New Enquiry
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {tiles.map((t) => (
            <div key={t.label} className="border-2 border-black bg-white p-3">
              <p className="text-xs font-bold uppercase text-gray-600">
                {t.label}
              </p>
              <p className="text-2xl font-bold">{t.value}</p>
            </div>
          ))}
        </div>

        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
          <input
            className={cn(inp, "pl-9")}
            placeholder="Search child, parent or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
              {f.key && summary?.byStatus?.[f.key]
                ? ` (${summary.byStatus[f.key]})`
                : ""}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="border-2 border-black bg-white p-10 text-center">
            <UserPlus className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="font-bold">No enquiries yet</p>
            <p className="text-sm text-gray-600">
              Log every call and walk-in so no admission slips away.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((l) => (
              <div
                key={l._id}
                onClick={() => openLead(l)}
                className="border-2 border-black bg-white p-4 cursor-pointer hover:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-black truncate">
                      {l.childName}
                      {l.age ? ` · ${l.age}y` : ""}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {[l.guardianName, l.phone, l.sport]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {label(l.source)}
                      {l.trialDate && l.status === "trial_scheduled"
                        ? ` · Trial ${fmt(l.trialDate)}`
                        : ""}
                      {l.followUpDate &&
                      l.status !== "converted" &&
                      l.status !== "lost"
                        ? ` · Follow-up ${fmt(l.followUpDate)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                    {isOverdue(l) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold uppercase border bg-red-50 border-red-500 text-red-700">
                        <AlertTriangle className="w-3 h-3" /> Overdue
                      </span>
                    )}
                    <span
                      className={cn(
                        "px-2 py-0.5 text-xs font-bold uppercase border",
                        STATUS_META[l.status].cls,
                      )}
                    >
                      {STATUS_META[l.status].label}
                    </span>
                  </div>
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
              <h2 className="font-bold text-lg">
                {editId ? "Edit Enquiry" : "New Enquiry"}
              </h2>
              <button onClick={() => setForm(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              className={inp}
              placeholder="Child's name *"
              value={form.childName}
              onChange={(e) => setForm({ ...form, childName: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                className={inp}
                type="number"
                min={0}
                placeholder="Age"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
              />
              <input
                className={cn(inp, "col-span-2")}
                placeholder="Parent / guardian name"
                value={form.guardianName}
                onChange={(e) =>
                  setForm({ ...form, guardianName: e.target.value })
                }
              />
            </div>
            <input
              className={inp}
              placeholder="Phone *"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <input
              className={inp}
              placeholder="Email (optional)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className={inp}
                placeholder="Sport interested in"
                value={form.sport}
                onChange={(e) => setForm({ ...form, sport: e.target.value })}
              />
              <input
                className={inp}
                placeholder="Preferred batch"
                value={form.batch}
                onChange={(e) => setForm({ ...form, batch: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                className={cn(inp, "bg-white")}
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className={inp}
                title="Follow-up date"
                value={form.followUpDate}
                onChange={(e) =>
                  setForm({ ...form, followUpDate: e.target.value })
                }
              />
            </div>
            <button
              onClick={saveForm}
              disabled={saving}
              className="w-full bg-[#024BAB] text-white border-2 border-black py-2 font-bold uppercase text-sm disabled:opacity-60"
            >
              {saving ? "Saving…" : editId ? "Save Changes" : "Add Enquiry"}
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="nb-backdrop fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="nb-modal border-2 border-black bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg">{open.childName}</h2>
                <p className="text-xs text-gray-600">
                  {[open.age ? `${open.age}y` : "", open.sport, open.batch]
                    .filter(Boolean)
                    .join(" · ")}{" "}
                  · via {label(open.source)} · {fmt(open.createdAt)}
                </p>
              </div>
              <button onClick={() => setOpen(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-bold">
                {open.guardianName || "Parent"} · {open.phone}
              </span>
              <a
                href={`tel:${open.phone}`}
                className="p-1.5 border-2 border-black"
                title="Call"
              >
                <Phone className="w-4 h-4" />
              </a>
              <a
                href={waLink(open.phone)}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 border-2 border-black"
                title="WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>

            {open.status === "lost" && open.lostReason && (
              <p className="text-sm text-red-700">Lost: {open.lostReason}</p>
            )}

            {open.status !== "converted" && (
              <>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(STATUS_META) as Status[])
                    .filter((s) => s !== "converted")
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(open, s)}
                        className={cn(
                          "px-3 py-1.5 border-2 border-black text-xs font-bold uppercase",
                          open.status === s ? "bg-black text-white" : "bg-white",
                        )}
                      >
                        {STATUS_META[s].label}
                      </button>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-bold uppercase">
                    <CalendarClock className="w-3.5 h-3.5 inline mr-1" />
                    Trial date
                    <input
                      type="date"
                      className={cn(inp, "mt-1 font-normal normal-case")}
                      value={trial}
                      onChange={(e) => setTrial(e.target.value)}
                    />
                  </label>
                  <label className="text-xs font-bold uppercase">
                    Follow-up
                    <div className="flex gap-1 mt-1">
                      <input
                        type="date"
                        className={cn(inp, "font-normal normal-case")}
                        value={follow}
                        onChange={(e) => setFollow(e.target.value)}
                      />
                      <button
                        onClick={saveFollowUp}
                        className="px-2 border-2 border-black text-xs font-bold"
                      >
                        Set
                      </button>
                    </div>
                  </label>
                </div>
                {isOwner && (
                  <button
                    onClick={() => convert(open)}
                    className="w-full bg-[#00C48C] text-black border-2 border-black py-2 font-bold uppercase text-sm"
                  >
                    Enrol as student
                  </button>
                )}
              </>
            )}

            <div className="border-t-2 border-black pt-3">
              <p className="text-xs font-bold uppercase mb-2">Notes</p>
              <div className="space-y-2 mb-2">
                {(open.notes || []).map((n) => (
                  <div key={n._id} className="text-sm bg-gray-50 p-2 border">
                    {n.text}
                    <span className="block text-xs text-gray-500">
                      {fmt(n.at)}
                    </span>
                  </div>
                ))}
                {!open.notes?.length && (
                  <p className="text-xs text-gray-500">No notes yet</p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 border-2 border-black px-3 py-2 text-sm"
                  placeholder="Add a note (call summary, objection…)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendNote()}
                />
                <button
                  onClick={sendNote}
                  className="px-3 border-2 border-black bg-[#024BAB] text-white text-xs font-bold uppercase"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              {open.status !== "converted" ? (
                <button
                  onClick={() => {
                    setEditId(open._id);
                    setForm({
                      childName: open.childName,
                      age: open.age != null ? String(open.age) : "",
                      guardianName: open.guardianName || "",
                      phone: open.phone,
                      email: open.email || "",
                      sport: open.sport || "",
                      batch: open.batch || "",
                      source: open.source,
                      followUpDate: dateInput(open.followUpDate),
                    });
                    setOpen(null);
                  }}
                  className="text-xs font-bold uppercase underline"
                >
                  Edit details
                </button>
              ) : (
                <span />
              )}
              {isOwner && (
                <button
                  onClick={() => remove(open)}
                  className="flex items-center gap-1.5 text-red-600 text-xs font-bold uppercase"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
