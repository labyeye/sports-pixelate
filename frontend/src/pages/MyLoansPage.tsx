import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { loanAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Banknote,
  Plus,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  IndianRupee,
} from "lucide-react";

interface Loan {
  _id: string;
  type: "loan" | "advance";
  amount: number;
  remainingBalance: number;
  monthlyEmi: number;
  tenureMonths?: number;
  reason: string;
  disbursedOn: string;
  status: "pending" | "active" | "rejected" | "cleared" | "paused";
  rejectionReason?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; cls: string; icon: typeof Clock }
> = {
  pending: {
    label: "Pending",
    cls: "bg-orange-50 border-orange-500 text-orange-800",
    icon: Clock,
  },
  active: {
    label: "Active",
    cls: "bg-green-50 border-green-500 text-green-800",
    icon: Banknote,
  },
  rejected: {
    label: "Rejected",
    cls: "bg-red-50 border-red-500 text-red-800",
    icon: XCircle,
  },
  cleared: {
    label: "Cleared",
    cls: "bg-gray-100 border-gray-400 text-gray-600",
    icon: CheckCircle2,
  },
  paused: {
    label: "Paused",
    cls: "bg-yellow-50 border-yellow-500 text-yellow-800",
    icon: Clock,
  },
};

const EMPTY_FORM = {
  type: "loan" as "loan" | "advance",
  amount: "",
  tenureMonths: "",
  reason: "",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function MyLoansPage() {
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loanAPI.getAll();
      setLoans(res.data || []);
    } catch {
      setLoans([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openRequest = () => {
    setForm({ ...EMPTY_FORM });
    setModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.reason.trim()) {
      toast({
        title: "Validation",
        description: "Amount and reason are required.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await loanAPI.request({
        type: form.type,
        amount: parseFloat(form.amount),
        tenureMonths: form.tenureMonths ? parseInt(form.tenureMonths) : 0,
        reason: form.reason.trim(),
      });
      toast({
        title: "Submitted",
        description: "Your request has been sent for approval.",
      });
      setModal(false);
      load();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const activeBalance = loans
    .filter((l) => l.status === "active")
    .reduce((s, l) => s + l.remainingBalance, 0);
  const pendingCount = loans.filter((l) => l.status === "pending").length;

  return (
    <AppLayout title="My Loans">
      <div className="w-full mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-3xl text-black">
              My Loans
            </h1>
            <p className="text-gray-600 font-medium mt-1">
              Request a loan or salary advance and track approvals
            </p>
          </div>
          <button
            onClick={openRequest}
            className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
          >
            <Plus className="w-4 h-4" /> Request Loan / Advance
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {[
            {
              label: "Outstanding Balance",
              value: fmt(activeBalance),
              icon: IndianRupee,
              color: "text-red-600",
            },
            {
              label: "Pending Requests",
              value: String(pendingCount),
              icon: Clock,
              color: "text-orange-600",
            },
            {
              label: "Total Requests",
              value: String(loans.length),
              icon: Banknote,
              color: "text-[#024BAB]",
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="border-2 border-black bg-white p-4 flex flex-col gap-1"
            >
              <div className="flex items-center gap-2">
                <Icon className={cn("w-4 h-4", color)} />
                <p className="text-xs font-bold text-gray-500 uppercase">
                  {label}
                </p>
              </div>
              <p className={cn("text-xl font-black", color)}>{value}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
          </div>
        ) : loans.length === 0 ? (
          <div className="border-2 border-black bg-white p-12 text-center">
            <Banknote className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-bold text-lg text-gray-500">
              No loan or advance requests yet
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Use the button above to request one
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {loans.map((l) => {
              const cfg = STATUS_CONFIG[l.status] || STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              return (
                <div
                  key={l._id}
                  className="bg-white border-2 border-black flex items-center justify-between px-5 py-4 gap-4 flex-wrap"
                >
                  <div className="flex items-center gap-3 min-w-[160px]">
                    <div className="w-10 h-10 bg-[#F0F6FF] border-2 border-black flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-[#024BAB]" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-black">
                        {l.type === "advance" ? "Salary Advance" : "Loan"}
                      </p>
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase border-2 px-2 py-0.5",
                          cfg.cls,
                        )}
                      >
                        {cfg.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-6 items-center flex-wrap">
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase text-gray-400">
                        Amount
                      </p>
                      <p className="text-sm font-bold text-black">
                        {fmt(l.amount)}
                      </p>
                    </div>
                    {l.tenureMonths ? (
                      <div className="text-center hidden sm:block">
                        <p className="text-[10px] font-bold uppercase text-gray-400">
                          Tenure
                        </p>
                        <p className="text-sm font-bold text-black">
                          {l.tenureMonths} mo
                        </p>
                      </div>
                    ) : null}
                    {l.status === "active" && (
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase text-red-400">
                          Balance
                        </p>
                        <p className="text-sm font-bold text-red-500">
                          {fmt(l.remainingBalance)}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="min-w-[160px] max-w-[260px]">
                    <p className="text-xs text-gray-600 truncate">{l.reason}</p>
                    {l.status === "rejected" && l.rejectionReason && (
                      <p className="text-xs text-red-600 mt-0.5">
                        Reason: {l.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b-2 border-black sticky top-0 bg-white z-10">
              <h3 className="font-display font-bold text-lg">
                Request Loan / Advance
              </h3>
              <button onClick={() => setModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as any })
                  }
                  className="border-2 w-full px-3 py-2 text-sm"
                >
                  <option value="loan">Loan</option>
                  <option value="advance">Salary Advance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="border-2 w-full px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  How many months to repay? (Tenure)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 6"
                  value={form.tenureMonths}
                  onChange={(e) =>
                    setForm({ ...form, tenureMonths: e.target.value })
                  }
                  className="border-2 w-full px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Reason *</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  rows={3}
                  placeholder="e.g. Medical emergency"
                  className="border-2 w-full px-3 py-2 text-sm resize-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1 disabled:opacity-60"
                >
                  {saving ? "Submitting..." : "Submit Request"}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="border-2 bg-white text-black px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
