import { useState, useEffect, useCallback, useMemo } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { exitAPI, employeeAPI, studentAPI } from "@/services/api";
import { fetchAllPages } from "@/lib/fetchAllPages";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDateOrDash, getErrorMessage } from "@/lib/utils";
import { StatCard } from "@/components/ui/StatCard";
import {
  UserMinus,
  Plus,
  Search,
  X,
  Loader2,
  Users,
  GraduationCap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Check,
  Package,
  IndianRupee,
  Wallet,
} from "lucide-react";

type PersonType = "employee" | "student";

const EMPLOYEE_EXIT_TYPES = [
  "resignation",
  "termination",
  "retirement",
  "contract_end",
  "absconded",
  "other",
];
const STUDENT_EXIT_TYPES = [
  "course_completed",
  "withdrawn",
  "relocated",
  "fee_issue",
  "injury",
  "other",
];
const labelOf = (v: string) =>
  v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const STATUS_META: Record<string, { bg: string; text: string; label: string }> =
  {
    initiated: { bg: "bg-[#FFD60A]", text: "text-black", label: "Initiated" },
    in_clearance: {
      bg: "bg-[#FA731C]",
      text: "text-white",
      label: "In clearance",
    },
    completed: { bg: "bg-[#00C48C]", text: "text-black", label: "Completed" },
    cancelled: { bg: "bg-gray-200", text: "text-gray-600", label: "Cancelled" },
    reinstated: { bg: "bg-[#A855F7]", text: "text-white", label: "Reinstated" },
  };

const toInput = (d?: string) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";
const todayStr = () => new Date().toISOString().slice(0, 10);

function Avatar({ src, name }: { src?: string; name: string }) {
  return src ? (
    <img
      src={src}
      alt={name}
      className="w-8 h-8 border-2 border-black object-cover rounded-full shrink-0"
    />
  ) : (
    <div className="w-8 h-8 bg-[#024BAB] border-2 border-black rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
      {name?.[0]?.toUpperCase()}
    </div>
  );
}

function TypeBadge({ type }: { type: PersonType }) {
  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase px-2 py-0.5 border-2 border-black whitespace-nowrap",
        type === "employee"
          ? "bg-[#024BAB] text-white"
          : "bg-[#A855F7] text-white",
      )}
    >
      {type === "employee" ? "Staff" : "Student"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || STATUS_META.initiated;
  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase px-2 py-0.5 border-2 border-black whitespace-nowrap",
        m.bg,
        m.text,
      )}
    >
      {m.label}
    </span>
  );
}

export default function ExitManagementPage() {
  const { toast } = useToast();
  const [exits, setExits] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    inProgress: 0,
    completed: 0,
    staff: 0,
    students: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showInitiate, setShowInitiate] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterType) params.personType = filterType;
      if (filterStatus) params.status = filterStatus;
      if (search) params.search = search;
      const res = await fetchAllPages(exitAPI.getAll, params);
      setExits(res.data || []);
      if (res.summary) setSummary(res.summary);
    } catch (e: unknown) {
      toast({ title: "Error", description: getErrorMessage(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <AppLayout title="Exit Management">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-black">
            Exit Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Offboard staff and students with a clearance checklist, final
            settlement and a clean status change.
          </p>
        </div>
        <button
          onClick={() => setShowInitiate(true)}
          className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
        >
          <Plus className="w-4 h-4" /> Initiate Exit
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Total Exits"
          value={summary.total}
          icon={UserMinus}
          color="#024BAB"
        />
        <StatCard
          label="In Progress"
          value={summary.inProgress}
          icon={Clock}
          color="#FA731C"
        />
        <StatCard
          label="Completed"
          value={summary.completed}
          icon={CheckCircle2}
          color="#00C48C"
        />
        <StatCard
          label="Staff · Students"
          value={`${summary.staff} · ${summary.students}`}
          icon={Users}
          color="#A855F7"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID"
            className="bg-transparent text-sm outline-none w-full font-medium"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">Staff &amp; Students</option>
          <option value="employee">Staff only</option>
          <option value="student">Students only</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Status</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        {(search || filterType || filterStatus) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterType("");
              setFilterStatus("");
            }}
            className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-2 hover:bg-red-50"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <img src={nesthrlogo} alt="NestPlay" className="h-16 w-auto" />
        </div>
      ) : exits.length === 0 ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <UserMinus className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No exit records</p>
          <p className="text-sm text-muted-foreground mt-1">
            Use "Initiate Exit" when a staff member or student is leaving.
          </p>
        </div>
      ) : (
        <div className="border-2 border-black bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "Person",
                  "Type",
                  "Exit Reason",
                  "Notice",
                  "Exit Date",
                  "Clearance",
                  "Status",
                  "",
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
              {exits.map((x, idx) => {
                const pct = x.progress.total
                  ? Math.round((x.progress.done / x.progress.total) * 100)
                  : 0;
                const ref = x.employee || x.student;
                return (
                  <tr
                    key={x._id}
                    className={cn(
                      "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                      idx % 2 ? "bg-[#F8FAFF]" : "",
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar src={ref?.avatar} name={x.personName} />
                        <div>
                          <p className="font-bold text-black">{x.personName}</p>
                          <p className="text-xs text-muted-foreground">
                            {x.personCode}
                            {x.personType === "employee" && ref?.designation
                              ? ` · ${ref.designation}`
                              : ""}
                            {x.personType === "student" && ref?.sport
                              ? ` · ${ref.sport}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={x.personType} />
                    </td>
                    <td className="px-4 py-3 text-black">
                      {labelOf(x.exitType)}
                    </td>
                    <td className="px-4 py-3 text-black whitespace-nowrap">
                      {formatDateOrDash(x.noticeDate)}
                    </td>
                    <td className="px-4 py-3 font-bold text-black whitespace-nowrap">
                      {formatDateOrDash(x.exitDate)}
                    </td>
                    <td className="px-4 py-3 min-w-36">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 border-2 border-black bg-white rounded-full overflow-hidden no-nb">
                          <div
                            className="h-full bg-[#00C48C]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold">
                          {x.progress.done}/{x.progress.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={x.status} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setOpenId(x._id)}
                        className="border-2 border-black bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#024BAB] hover:text-white"
                      >
                        {["initiated", "in_clearance"].includes(x.status)
                          ? "Manage"
                          : "View"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showInitiate && (
        <InitiateModal
          onClose={() => setShowInitiate(false)}
          onCreated={(id) => {
            setShowInitiate(false);
            load();
            setOpenId(id);
          }}
        />
      )}
      {openId && (
        <ExitDetailModal
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </AppLayout>
  );
}

/* ───────────────────────── Initiate ───────────────────────── */

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div
        className={cn(
          "border-2 border-black bg-white w-full max-h-[calc(100vh-2rem)] flex flex-col",
          wide ? "max-w-3xl" : "max-w-xl",
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-[#024BAB]">
          <div>
            <h3 className="font-bold text-lg text-white">{title}</h3>
            {subtitle && <p className="text-xs text-white/80">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none";
const labelCls = "block text-xs font-bold uppercase mb-1";

function InitiateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const [personType, setPersonType] = useState<PersonType>("employee");
  const [people, setPeople] = useState<any[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [personSearch, setPersonSearch] = useState("");
  const [personId, setPersonId] = useState("");
  const [exitType, setExitType] = useState("resignation");
  const [reason, setReason] = useState("");
  const [noticeDate, setNoticeDate] = useState(todayStr());
  const [exitDate, setExitDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPersonId("");
    setPersonSearch("");
    setExitType(personType === "employee" ? "resignation" : "withdrawn");
    setLoadingPeople(true);
    const fn =
      personType === "employee" ? employeeAPI.getAll : studentAPI.getAll;
    fetchAllPages(fn, { status: "active" })
      .then((r) => setPeople(r.data || []))
      .catch(() => setPeople([]))
      .finally(() => setLoadingPeople(false));
  }, [personType]);

  const filtered = useMemo(() => {
    const q = personSearch.toLowerCase();
    return people.filter(
      (p) =>
        !q ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        (p.employeeId || p.studentId || "").toLowerCase().includes(q),
    );
  }, [people, personSearch]);

  const submit = async () => {
    if (!personId) {
      toast({ title: "Choose who is leaving", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await exitAPI.initiate({
        personType,
        personId,
        exitType,
        reason,
        noticeDate,
        exitDate,
        notes,
      });
      toast({ title: "Exit initiated" });
      onCreated(res.data._id);
    } catch (e: unknown) {
      toast({ title: "Error", description: getErrorMessage(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const types =
    personType === "employee" ? EMPLOYEE_EXIT_TYPES : STUDENT_EXIT_TYPES;

  return (
    <ModalShell title="Initiate Exit" onClose={onClose}>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex border-2 border-black no-nb">
          {(
            [
              ["employee", "Staff", Users],
              ["student", "Student", GraduationCap],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPersonType(key)}
              className={cn(
                "flex-1 py-2 text-xs font-bold uppercase flex items-center justify-center gap-1.5",
                key === "student" && "border-l-2 border-black",
                personType === key
                  ? "bg-[#024BAB] text-white"
                  : "bg-white hover:bg-[#024BAB]/5",
              )}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <div>
          <label className={labelCls}>
            {personType === "employee" ? "Staff member" : "Student"} *
          </label>
          <input
            value={personSearch}
            onChange={(e) => setPersonSearch(e.target.value)}
            placeholder="Search by name or ID"
            className={cn(inputCls, "mb-2")}
          />
          <div className="border-2 border-black max-h-44 overflow-y-auto">
            {loadingPeople ? (
              <div className="p-4 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                No active {personType === "employee" ? "staff" : "students"}{" "}
                found
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => setPersonId(p._id)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm flex items-center gap-2 border-b border-black/10 last:border-0",
                    personId === p._id
                      ? "bg-[#024BAB] text-white"
                      : "hover:bg-[#024BAB]/5",
                  )}
                >
                  <span className="font-bold">
                    {p.firstName} {p.lastName}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      personId === p._id
                        ? "text-white/80"
                        : "text-muted-foreground",
                    )}
                  >
                    {p.employeeId || p.studentId}
                    {p.designation ? ` · ${p.designation}` : ""}
                    {p.sport ? ` · ${p.sport}` : ""}
                  </span>
                  {personId === p._id && <Check className="w-4 h-4 ml-auto" />}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Exit type *</label>
            <select
              value={exitType}
              onChange={(e) => setExitType(e.target.value)}
              className={inputCls}
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {labelOf(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Notice date</label>
            <input
              type="date"
              value={noticeDate}
              onChange={(e) => setNoticeDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              {personType === "employee" ? "Last working day" : "Last class"} *
            </label>
            <input
              type="date"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className={inputCls}
            placeholder="Why are they leaving?"
          />
        </div>
        <div>
          <label className={labelCls}>Internal notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 border-t-2 border-black">
        <button
          onClick={onClose}
          className="border-2 border-black bg-white px-4 py-2 text-sm font-bold uppercase"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold uppercase flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserMinus className="w-4 h-4" />
          )}
          Start Exit
        </button>
      </div>
    </ModalShell>
  );
}

/* ───────────────────────── Detail / clearance ───────────────────────── */

function ExitDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [rec, setRec] = useState<any>(null);
  const [outstanding, setOutstanding] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await exitAPI.getOne(id);
      setRec(res.data);
      setOutstanding(res.outstanding);
      setForm({
        exitType: res.data.exitType,
        reason: res.data.reason || "",
        noticeDate: toInput(res.data.noticeDate),
        exitDate: toInput(res.data.exitDate),
        settlementAmount: String(res.data.settlementAmount || ""),
        settlementNotes: res.data.settlementNotes || "",
        settlementPaid: !!res.data.settlementPaid,
        feedback: res.data.feedback || "",
        eligibleForRehire: res.data.eligibleForRehire !== false,
        notes: res.data.notes || "",
      });
    } catch (e: unknown) {
      toast({ title: "Error", description: getErrorMessage(e), variant: "destructive" });
      onClose();
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!rec) {
    return (
      <ModalShell title="Exit" onClose={onClose}>
        <div className="p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </ModalShell>
    );
  }

  const editable = ["initiated", "in_clearance"].includes(rec.status);
  const isStaff = rec.personType === "employee";
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const run = async (name: string, fn: () => Promise<any>, ok: string) => {
    setBusy(name);
    try {
      await fn();
      toast({ title: ok });
      await load();
      onChanged();
    } catch (e: unknown) {
      toast({ title: "Error", description: getErrorMessage(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run(
      "save",
      () =>
        exitAPI.update(id, {
          ...form,
          settlementAmount: Number(form.settlementAmount) || 0,
        }),
      "Saved",
    );

  const toggle = (key: string, done: boolean) =>
    run(
      "toggle",
      () => exitAPI.update(id, { checklist: [{ key, done }] }),
      done ? "Marked done" : "Marked pending",
    );

  const complete = async () => {
    const pending = rec.checklist.filter((c: any) => c.required && !c.done);
    let force = false;
    if (pending.length > 0) {
      force = confirm(
        `${pending.length} required clearance item(s) are still pending:\n\n• ${pending
          .map((c: any) => c.label)
          .join("\n• ")}\n\nComplete the exit anyway?`,
      );
      if (!force) return;
    } else if (
      !confirm(
        `Complete exit for ${rec.personName}? Their status will change to ${isStaff ? "inactive/terminated and login will be disabled" : "inactive and open plans will be cancelled"}.`,
      )
    )
      return;
    await run("complete", () => exitAPI.complete(id, force), "Exit completed");
  };

  const hasOutstanding =
    outstanding &&
    (outstanding.loans?.length ||
      outstanding.inventory?.length ||
      outstanding.subscriptions?.length ||
      outstanding.payrolls);

  return (
    <ModalShell
      wide
      title={rec.personName}
      subtitle={`${isStaff ? "Staff" : "Student"} · ${rec.personCode} · ${labelOf(rec.exitType)}`}
      onClose={onClose}
    >
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={rec.status} />
          <TypeBadge type={rec.personType} />
          <span className="text-xs text-muted-foreground">
            Exit date <b className="text-black">{formatDateOrDash(rec.exitDate)}</b>
            {rec.completedAt && (
              <>
                {" "}
                · Completed{" "}
                <b className="text-black">{formatDateOrDash(rec.completedAt)}</b>
              </>
            )}
          </span>
        </div>

        {editable && hasOutstanding ? (
          <div className="border-2 border-[#FA731C] bg-[#FA731C]/5 p-4 space-y-2 no-nb">
            <p className="flex items-center gap-2 font-bold text-sm text-[#C2410C]">
              <AlertTriangle className="w-4 h-4" /> Still outstanding
            </p>
            <ul className="text-sm text-black space-y-1">
              {outstanding.loans?.map((l: any) => (
                <li key={l._id} className="flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 shrink-0" />
                  {labelOf(l.type || "loan")} — ₹
                  {Number(l.remainingBalance).toLocaleString("en-IN")} remaining
                </li>
              ))}
              {outstanding.inventory?.map((i: any) => (
                <li key={i._id} className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 shrink-0" />
                  {i.name} × {i.quantity} not returned
                </li>
              ))}
              {outstanding.subscriptions?.map((s: any) => (
                <li key={s._id} className="flex items-center gap-2">
                  <IndianRupee className="w-3.5 h-3.5 shrink-0" />
                  {s.planName}: ₹
                  {Number(s.amountPaid || 0).toLocaleString("en-IN")} paid of ₹
                  {Number(s.amount).toLocaleString("en-IN")} (
                  {labelOf(s.status)}) — will be cancelled on completion
                </li>
              ))}
              {outstanding.payrolls > 0 && (
                <li className="flex items-center gap-2">
                  <IndianRupee className="w-3.5 h-3.5 shrink-0" />
                  {outstanding.payrolls} payroll record(s) not yet paid
                </li>
              )}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="text-xs font-bold uppercase mb-2">
            Clearance checklist ({rec.progress.done}/{rec.progress.total})
          </p>
          <div className="space-y-2">
            {rec.checklist.map((c: any) => (
              <label
                key={c.key}
                className={cn(
                  "flex items-center gap-3 border-2 border-black px-3 py-2 text-sm",
                  editable ? "cursor-pointer" : "opacity-80",
                  c.done ? "bg-[#00C48C]/10" : "bg-white",
                )}
              >
                <input
                  type="checkbox"
                  checked={c.done}
                  disabled={!editable || busy === "toggle"}
                  onChange={(e) => toggle(c.key, e.target.checked)}
                  className="w-4 h-4 accent-[#024BAB]"
                />
                <span className="flex-1 font-medium text-black">
                  {c.label}
                  {!c.required && (
                    <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                      optional
                    </span>
                  )}
                </span>
                {c.done && c.doneAt && (
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateOrDash(c.doneAt)}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Exit type</label>
            <select
              value={form.exitType}
              disabled={!editable}
              onChange={(e) => set("exitType", e.target.value)}
              className={inputCls}
            >
              {(isStaff ? EMPLOYEE_EXIT_TYPES : STUDENT_EXIT_TYPES).map((t) => (
                <option key={t} value={t}>
                  {labelOf(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Exit date</label>
            <input
              type="date"
              value={form.exitDate}
              disabled={!editable}
              onChange={(e) => set("exitDate", e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Reason</label>
            <textarea
              rows={2}
              value={form.reason}
              disabled={!editable}
              onChange={(e) => set("reason", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Final settlement (₹){" "}
              <span className="normal-case font-normal text-muted-foreground">
                {isStaff ? "payable to staff" : "refund to family"}
              </span>
            </label>
            <input
              type="number"
              min={0}
              value={form.settlementAmount}
              disabled={!editable}
              onChange={(e) => set("settlementAmount", e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={form.settlementPaid}
                disabled={!editable}
                onChange={(e) => set("settlementPaid", e.target.checked)}
                className="w-4 h-4 accent-[#024BAB]"
              />
              Settlement paid
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Settlement notes</label>
            <input
              value={form.settlementNotes}
              disabled={!editable}
              onChange={(e) => set("settlementNotes", e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>
              {isStaff
                ? "Exit interview feedback"
                : "Parent / student feedback"}
            </label>
            <textarea
              rows={3}
              value={form.feedback}
              disabled={!editable}
              onChange={(e) => set("feedback", e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="rehire"
              type="checkbox"
              checked={form.eligibleForRehire}
              disabled={!editable}
              onChange={(e) => set("eligibleForRehire", e.target.checked)}
              className="w-4 h-4 accent-[#024BAB]"
            />
            <label htmlFor="rehire" className="text-sm font-bold">
              {isStaff ? "Eligible for rehire" : "Welcome back to re-enrol"}
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Internal notes</label>
            <textarea
              rows={2}
              value={form.notes}
              disabled={!editable}
              onChange={(e) => set("notes", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3 px-6 py-4 border-t-2 border-black">
        {editable && (
          <>
            <button
              onClick={() =>
                confirm("Cancel this exit? The person stays as they are.") &&
                run("cancel", () => exitAPI.cancel(id), "Exit cancelled")
              }
              disabled={!!busy}
              className="border-2 border-black bg-white px-4 py-2 text-sm font-bold uppercase text-red-600 mr-auto"
            >
              Cancel Exit
            </button>
            <button
              onClick={save}
              disabled={!!busy}
              className="border-2 border-black bg-white px-4 py-2 text-sm font-bold uppercase flex items-center gap-2 disabled:opacity-60"
            >
              {busy === "save" && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
            <button
              onClick={complete}
              disabled={!!busy}
              className="border-2 border-black bg-[#00C48C] text-black px-4 py-2 text-sm font-bold uppercase flex items-center gap-2 disabled:opacity-60"
            >
              {busy === "complete" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Complete Exit
            </button>
          </>
        )}
        {rec.status === "completed" && (
          <button
            onClick={() =>
              confirm(
                `Reinstate ${rec.personName}? Their previous status is restored${isStaff ? " and login is re-enabled" : ""}.`,
              ) && run("reinstate", () => exitAPI.reinstate(id), "Reinstated")
            }
            disabled={!!busy}
            className="border-2 border-black bg-[#A855F7] text-white px-4 py-2 text-sm font-bold uppercase flex items-center gap-2 disabled:opacity-60"
          >
            <RotateCcw className="w-4 h-4" /> Reinstate
          </button>
        )}
        {!editable && (
          <button
            onClick={onClose}
            className="border-2 border-black bg-white px-4 py-2 text-sm font-bold uppercase"
          >
            Close
          </button>
        )}
      </div>
    </ModalShell>
  );
}
