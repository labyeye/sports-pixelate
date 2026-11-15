import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { expenseClaimAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Receipt, Plus, X, Paperclip, Trash2, Settings2, RotateCcw, Wallet, AlertTriangle } from "lucide-react";

const CATEGORIES = [
  ["travel", "Travel"],
  ["food", "Food"],
  ["fuel", "Fuel"],
  ["lodging", "Lodging"],
  ["internet_phone", "Internet / Phone"],
  ["office", "Office supplies"],
  ["other", "Other"],
];
const PAY_MODES = [
  ["bank_transfer", "Bank transfer"],
  ["upi", "UPI"],
  ["cash", "Cash"],
  ["cheque", "Cheque"],
];
const ROLE_LABEL: Record<string, string> = {
  department_head: "Department Head",
  hr_manager: "HR Manager",
  super_admin: "Super Admin",
};
const STATUS_CLS: Record<string, string> = {
  draft: "bg-gray-50 border-gray-400 text-gray-700",
  pending: "bg-orange-50 border-orange-500 text-orange-800",
  approved: "bg-blue-50 border-blue-500 text-blue-800",
  paid: "bg-green-50 border-green-500 text-green-800",
  rejected: "bg-red-50 border-red-500 text-red-800",
};
const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

type Step = { role: string; status?: string; note?: string; aboveAmount?: number };
type Claim = {
  _id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  notes: string;
  status: string;
  hasBill: boolean;
  billCount?: number;
  details?: Record<string, any>;
  approvedAmount?: number;
  policyExceeded?: boolean;
  payment?: { mode?: string; paidOn?: string; reference?: string };
  resubmissionOf?: string;
  canAct: boolean;
  steps: Step[];
  employee?: { firstName: string; lastName: string; employeeId: string };
};

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = {
  title: "",
  category: "other",
  amount: "",
  date: today(),
  notes: "",
  vendor: "",
  from: "",
  to: "",
  distanceKm: "",
  fuelLitres: "",
  checkIn: "",
  checkOut: "",
};
type Form = typeof EMPTY;
type Policy = { limits: Record<string, number>; billRequiredAbove: number };

export default function ExpenseClaimsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isHR = user?.role === "super_admin" || user?.role === "hr_manager";
  const canApprove = isHR || user?.role === "department_head";
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [bills, setBills] = useState<File[]>([]);
  const [policy, setPolicy] = useState<Policy>({ limits: {}, billRequiredAbove: 0 });
  const [polForm, setPolForm] = useState<Policy | null>(null);
  const [payFor, setPayFor] = useState<Claim | null>(null);
  const [pay, setPay] = useState({ mode: "bank_transfer", reference: "", paidOn: today() });
  const [saving, setSaving] = useState(false);
  const [flow, setFlow] = useState<Step[] | null>(null);

  const err = (e: any) => toast({ title: e.message, variant: "destructive" });

  const load = useCallback(async () => {
    try {
      const r = await expenseClaimAPI.getAll();
      setClaims(r.data);
    } catch (e) {
      err(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    load();
    expenseClaimAPI.getPolicy().then((r) => setPolicy(r.data)).catch(() => {});
  }, [load]);

  const submit = async (draft: boolean) => {
    if (!form) return;
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => v !== "" && fd.append(k, v));
    if (draft) fd.append("draft", "true");
    bills.forEach((f) => fd.append("bills", f));
    setSaving(true);
    try {
      await expenseClaimAPI.create(fd, editId || undefined);
      toast({ title: draft ? "Draft saved" : "Claim submitted" });
      setForm(null);
      setEditId(null);
      setBills([]);
      load();
    } catch (e) {
      err(e);
    } finally {
      setSaving(false);
    }
  };

  const editDraft = (c: Claim) => {
    const d = c.details || {};
    const dt = (v?: string) => (v ? v.slice(0, 10) : "");
    setEditId(c._id);
    setBills([]);
    setForm({
      ...EMPTY,
      title: c.title,
      category: c.category,
      amount: String(c.amount),
      date: dt(c.date),
      notes: c.notes || "",
      vendor: d.vendor || "",
      from: d.from || "",
      to: d.to || "",
      distanceKm: d.distanceKm != null ? String(d.distanceKm) : "",
      fuelLitres: d.fuelLitres != null ? String(d.fuelLitres) : "",
      checkIn: dt(d.checkIn),
      checkOut: dt(d.checkOut),
    });
  };

  const resubmit = async (c: Claim) => {
    try {
      await expenseClaimAPI.resubmit(c._id);
      toast({ title: "Claim resubmitted for approval" });
      load();
    } catch (e) {
      err(e);
    }
  };

  const doPay = async () => {
    if (!payFor) return;
    try {
      await expenseClaimAPI.markPaid(payFor._id, pay);
      toast({ title: "Marked as paid" });
      setPayFor(null);
      load();
    } catch (e) {
      err(e);
    }
  };

  const savePolicy = async () => {
    if (!polForm) return;
    try {
      await expenseClaimAPI.savePolicy(polForm);
      setPolicy(polForm);
      toast({ title: "Expense policy saved" });
      setPolForm(null);
    } catch (e) {
      err(e);
    }
  };

  const act = async (c: Claim, action: "approve" | "reject") => {
    const note =
      action === "reject" ? window.prompt("Reason for rejection?") || "" : "";
    if (action === "reject" && !note) return;
    let approved: number | undefined;
    if (action === "approve") {
      const v = window.prompt(
        `Amount to approve (claimed ${fmt(c.amount)}). Leave as is for full amount.`,
        String(c.approvedAmount ?? c.amount),
      );
      if (v === null) return;
      approved = Number(v);
    }
    let reason = note;
    if (approved !== undefined && approved < c.amount) {
      reason = window.prompt("Reason for the reduced amount?") || "";
      if (!reason) return;
    }
    try {
      await expenseClaimAPI.act(c._id, action, reason, approved);
      load();
    } catch (e) {
      err(e);
    }
  };

  const openFlow = async () => {
    try {
      setFlow((await expenseClaimAPI.getWorkflow()).data);
    } catch (e) {
      err(e);
    }
  };
  const saveFlow = async () => {
    if (!flow) return;
    try {
      await expenseClaimAPI.saveWorkflow(
        flow.map((s) => ({ role: s.role, aboveAmount: s.aboveAmount || 0 })),
      );
      toast({ title: "Approval workflow saved" });
      setFlow(null);
    } catch (e) {
      err(e);
    }
  };

  const inbox = claims.filter((c) => c.canAct);
  const input = "border-2 border-black px-3 py-2 text-sm w-full";

  const detailLine = (c: Claim) => {
    const d = c.details || {};
    const dd = (v?: string) => new Date(v!).toLocaleDateString("en-IN");
    return [
      d.from || d.to ? `${d.from || "?"} → ${d.to || "?"}` : "",
      d.distanceKm != null ? `${d.distanceKm} km` : "",
      d.fuelLitres != null ? `${d.fuelLitres} L` : "",
      d.checkIn ? `${dd(d.checkIn)}${d.checkOut ? ` – ${dd(d.checkOut)}` : ""}` : "",
      d.vendor || "",
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const Row = ({ c }: { c: Claim }) => (
    <div className="bg-white border-2 border-black px-5 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-[180px]">
        <p className="font-bold text-sm">{c.title}</p>
        <p className="text-xs text-gray-500">
          {c.employee
            ? `${c.employee.firstName} ${c.employee.lastName} (${c.employee.employeeId}) · `
            : ""}
          {CATEGORIES.find((x) => x[0] === c.category)?.[1]} ·{" "}
          {new Date(c.date).toLocaleDateString("en-IN")}
        </p>
        {c.notes && <p className="text-xs text-gray-600 mt-1">{c.notes}</p>}
        {detailLine(c) && (
          <p className="text-xs text-gray-600 mt-1">{detailLine(c)}</p>
        )}
        {c.policyExceeded && (
          <p className="text-xs text-orange-700 font-bold mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Above policy limit
          </p>
        )}
        {c.status === "paid" && c.payment?.paidOn && (
          <p className="text-xs text-green-700 mt-1">
            Paid {new Date(c.payment.paidOn).toLocaleDateString("en-IN")} via{" "}
            {c.payment.mode === "payroll"
              ? "payroll"
              : PAY_MODES.find((m) => m[0] === c.payment?.mode)?.[1]}
            {c.payment.reference ? ` · ${c.payment.reference}` : ""}
          </p>
        )}
      </div>
      <div className="flex gap-1 flex-wrap">
        {c.steps.map((s, i) => (
          <span
            key={i}
            title={s.note || ""}
            className={cn(
              "text-[10px] font-bold uppercase border-2 px-2 py-0.5",
              s.status === "approved"
                ? STATUS_CLS.paid
                : s.status === "rejected"
                  ? STATUS_CLS.rejected
                  : "bg-gray-50 border-gray-300 text-gray-500",
            )}
          >
            {ROLE_LABEL[s.role] || s.role}
          </span>
        ))}
      </div>
      <div className="text-right">
        <p className="font-bold">{fmt(c.approvedAmount ?? c.amount)}</p>
        {c.approvedAmount != null && c.approvedAmount < c.amount && (
          <p className="text-[10px] text-gray-500 line-through">{fmt(c.amount)}</p>
        )}
      </div>
      <span
        className={cn(
          "text-[10px] font-bold uppercase border-2 px-2 py-0.5",
          STATUS_CLS[c.status],
        )}
      >
        {c.status}
      </span>
      <div className="flex gap-2 items-center">
        {Array.from({ length: c.billCount || 0 }, (_, i) => (
          <button
            key={i}
            title={`Download bill ${i + 1}`}
            onClick={() => expenseClaimAPI.downloadBill(c._id, i).catch(err)}
          >
            <Paperclip className="w-4 h-4" />
          </button>
        ))}
        {c.status === "draft" && (
          <button
            onClick={() => editDraft(c)}
            className="bg-white px-3 py-1 text-xs font-bold border-2 border-black"
          >
            Edit / Submit
          </button>
        )}
        {c.status === "rejected" && !canApprove && !c.resubmissionOf && (
          <button
            title="Resubmit"
            onClick={() => resubmit(c)}
            className="bg-white px-3 py-1 text-xs font-bold border-2 border-black flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Resubmit
          </button>
        )}
        {c.status === "approved" && isHR && (
          <button
            onClick={() => setPayFor(c)}
            className="bg-white px-3 py-1 text-xs font-bold border-2 border-black flex items-center gap-1"
          >
            <Wallet className="w-3 h-3" /> Mark paid
          </button>
        )}
        {c.canAct && (
          <>
            <button
              onClick={() => act(c, "approve")}
              className="bg-green-600 text-white px-3 py-1 text-xs font-bold border-2 border-black"
            >
              Approve
            </button>
            <button
              onClick={() => act(c, "reject")}
              className="bg-white text-red-700 px-3 py-1 text-xs font-bold border-2 border-black"
            >
              Reject
            </button>
          </>
        )}
        {!canApprove &&
          (c.status === "draft" || c.status === "pending") &&
          c.steps.every((s) => s.status === "pending") && (
            <button
              title="Withdraw"
              onClick={() =>
                expenseClaimAPI
                  .remove(c._id)
                  .then(load)
                  .catch(err)
              }
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          )}
      </div>
    </div>
  );

  return (
    <AppLayout title="Expenses">
      <div className="w-full mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-3xl text-black">
              Expense Claims
            </h1>
            <p className="text-gray-600 font-medium mt-1">
              Claim reimbursements; approved amounts are added to the next payroll
            </p>
          </div>
          <div className="flex gap-2">
            {isHR && (
              <button
                onClick={() => setPolForm({ ...policy })}
                className="bg-white border-2 border-black px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
              >
                <Settings2 className="w-4 h-4" /> Policy Limits
              </button>
            )}
            {isHR && (
              <button
                onClick={openFlow}
                className="bg-white border-2 border-black px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
              >
                <Settings2 className="w-4 h-4" /> Approval Workflow
              </button>
            )}
            <button
              onClick={() => {
                setEditId(null);
                setBills([]);
                setForm({ ...EMPTY });
              }}
              className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
            >
              <Plus className="w-4 h-4" /> New Claim
            </button>
          </div>
        </div>

        {canApprove && inbox.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-sm uppercase text-gray-500 mb-2">
              Waiting for your approval ({inbox.length})
            </h2>
            <div className="space-y-2">
              {inbox.map((c) => (
                <Row key={c._id} c={c} />
              ))}
            </div>
          </div>
        )}

        <h2 className="font-bold text-sm uppercase text-gray-500 mb-2">
          {canApprove ? "All claims" : "My claims"}
        </h2>
        {loading ? null : claims.length === 0 ? (
          <div className="border-2 border-black bg-white p-12 text-center">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-bold text-gray-500">No expense claims yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {claims.map((c) => (
              <Row key={c._id} c={c} />
            ))}
          </div>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-black w-full max-w-md p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">
                {editId ? "Edit draft" : "New expense claim"}
              </h3>
              <button onClick={() => setForm(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              className={input}
              placeholder="What was it for?"
              maxLength={120}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                className={input}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input
                className={input}
                type="number"
                min={1}
                placeholder="Amount (₹)"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            {policy.limits[form.category] > 0 && (
              <p className="text-xs text-gray-600">
                Policy limit for this category: {fmt(policy.limits[form.category])}
                {Number(form.amount) > policy.limits[form.category] &&
                  " — your claim is above it and will be flagged"}
              </p>
            )}
            <input
              className={input}
              type="date"
              max={today()}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            {form.category === "travel" && (
              <div className="grid grid-cols-3 gap-3">
                <input className={input} placeholder="From" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
                <input className={input} placeholder="To" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
                <input className={input} type="number" min={0} placeholder="Distance (km)" value={form.distanceKm} onChange={(e) => setForm({ ...form, distanceKm: e.target.value })} />
              </div>
            )}
            {form.category === "fuel" && (
              <div className="grid grid-cols-2 gap-3">
                <input className={input} type="number" min={0} placeholder="Distance (km)" value={form.distanceKm} onChange={(e) => setForm({ ...form, distanceKm: e.target.value })} />
                <input className={input} type="number" min={0} placeholder="Litres" value={form.fuelLitres} onChange={(e) => setForm({ ...form, fuelLitres: e.target.value })} />
              </div>
            )}
            {form.category === "lodging" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold">
                  Check-in
                  <input className={input} type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
                </label>
                <label className="text-xs font-bold">
                  Check-out
                  <input className={input} type="date" min={form.checkIn} value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
                </label>
              </div>
            )}
            {form.category !== "travel" && (
              <input
                className={input}
                placeholder={
                  form.category === "lodging"
                    ? "Hotel name"
                    : form.category === "fuel"
                      ? "Petrol pump"
                      : "Vendor / shop (optional)"
                }
                maxLength={100}
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              />
            )}
            <textarea
              className={input}
              rows={2}
              maxLength={500}
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <div>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={(e) => setBills(Array.from(e.target.files || []).slice(0, 5))}
                className="text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Up to 5 bills (JPG, PNG, WEBP or PDF)
                {policy.billRequiredAbove > 0 &&
                  `; required above ${fmt(policy.billRequiredAbove)}`}
                {editId && "; new files are added to existing bills"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                disabled={saving || !form.title || !form.amount}
                onClick={() => submit(true)}
                className="flex-1 bg-white py-2 font-bold border-2 border-black disabled:opacity-40"
              >
                Save draft
              </button>
              <button
                disabled={saving || !form.title || !form.amount}
                onClick={() => submit(false)}
                className="flex-1 bg-[#024BAB] text-white py-2 font-bold border-2 border-black disabled:opacity-40"
              >
                {saving ? "Submitting…" : "Submit claim"}
              </button>
            </div>
          </div>
        </div>
      )}

      {polForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-black w-full max-w-md p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Expense policy limits</h3>
              <button onClick={() => setPolForm(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Max amount per claim by category (blank = no limit). Claims above
              a limit are flagged for approvers.
            </p>
            {CATEGORIES.map(([v, l]) => (
              <label key={v} className="flex items-center gap-3 text-sm font-bold">
                <span className="w-36">{l}</span>
                <input
                  className={input}
                  type="number"
                  min={0}
                  placeholder="₹ limit"
                  value={polForm.limits[v] || ""}
                  onChange={(e) =>
                    setPolForm({
                      ...polForm,
                      limits: { ...polForm.limits, [v]: Number(e.target.value) },
                    })
                  }
                />
              </label>
            ))}
            <label className="flex items-center gap-3 text-sm font-bold">
              <span className="w-36">Bill required above</span>
              <input
                className={input}
                type="number"
                min={0}
                placeholder="₹ (0 = never)"
                value={polForm.billRequiredAbove || ""}
                onChange={(e) =>
                  setPolForm({ ...polForm, billRequiredAbove: Number(e.target.value) })
                }
              />
            </label>
            <button
              onClick={savePolicy}
              className="w-full bg-[#024BAB] text-white py-2 font-bold border-2 border-black"
            >
              Save policy
            </button>
          </div>
        </div>
      )}

      {payFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-black w-full max-w-sm p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">
                Pay {fmt(payFor.approvedAmount ?? payFor.amount)}
              </h3>
              <button onClick={() => setPayFor(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Settles the claim now instead of adding it to payroll.
            </p>
            <select
              className={input}
              value={pay.mode}
              onChange={(e) => setPay({ ...pay, mode: e.target.value })}
            >
              {PAY_MODES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input
              className={input}
              placeholder="Reference / UTR / cheque no."
              maxLength={100}
              value={pay.reference}
              onChange={(e) => setPay({ ...pay, reference: e.target.value })}
            />
            <input
              className={input}
              type="date"
              max={today()}
              value={pay.paidOn}
              onChange={(e) => setPay({ ...pay, paidOn: e.target.value })}
            />
            <button
              onClick={doPay}
              className="w-full bg-[#024BAB] text-white py-2 font-bold border-2 border-black"
            >
              Confirm payment
            </button>
          </div>
        </div>
      )}

      {flow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-black w-full max-w-lg p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Expense approval workflow</h3>
              <button onClick={() => setFlow(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Steps run in order. A step with a minimum amount only applies to
              claims of that size or more.
            </p>
            {flow.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="font-bold text-sm w-6">{i + 1}.</span>
                <select
                  className={input}
                  value={s.role}
                  onChange={(e) =>
                    setFlow(
                      flow.map((x, j) =>
                        j === i ? { ...x, role: e.target.value } : x,
                      ),
                    )
                  }
                >
                  {Object.entries(ROLE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <input
                  className={input}
                  type="number"
                  min={0}
                  placeholder="Min ₹ (0 = always)"
                  value={s.aboveAmount || ""}
                  onChange={(e) =>
                    setFlow(
                      flow.map((x, j) =>
                        j === i ? { ...x, aboveAmount: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                <button
                  disabled={flow.length === 1}
                  onClick={() => setFlow(flow.filter((_, j) => j !== i))}
                  className="disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <button
                disabled={flow.length >= 4}
                onClick={() =>
                  setFlow([...flow, { role: "super_admin", aboveAmount: 0 }])
                }
                className="border-2 border-black px-3 py-2 text-sm font-bold disabled:opacity-40"
              >
                + Add step
              </button>
              <button
                onClick={saveFlow}
                className="flex-1 bg-[#024BAB] text-white py-2 font-bold border-2 border-black"
              >
                Save workflow
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
