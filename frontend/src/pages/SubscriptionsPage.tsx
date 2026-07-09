import { useState, useEffect, useCallback, useMemo } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { subscriptionAPI, sportsPlanAPI, studentAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Wallet,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  ArrowUp,
  ArrowDown,
  X,
  Users,
  IndianRupee,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Subscription {
  _id: string;
  student: { _id: string; firstName: string; lastName: string };
  plan: { _id: string; name: string };
  planName: string;
  billingCycle: string;
  amount: number;
  renewalDate: string;
  status: string;
  paymentStatus: string;
}

const STATUS_META: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-green-50", text: "text-green-700" },
  inactive: { bg: "bg-gray-50", text: "text-gray-500" },
  cancelled: { bg: "bg-red-50", text: "text-red-600" },
  pending_renewal: { bg: "bg-yellow-50", text: "text-yellow-700" },
};

type SortKey = "student" | "plan" | "amount" | "renewalDate";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isParent = user?.role === "parent";

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  const [selectedChild, setSelectedChild] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCycle, setFilterCycle] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("renewalDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, planRes] = await Promise.all([
        subscriptionAPI.getAll(),
        sportsPlanAPI.getAll(),
      ]);
      setSubscriptions(subRes.data);
      setPlans(planRes.data);
      if (isParent) {
        const studRes = await studentAPI.getAll();
        setChildren(studRes.data);
        if (studRes.data[0]) setSelectedChild(studRes.data[0]._id);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [isParent]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubscribe = async () => {
    if (!selectedChild || !selectedPlan) {
      toast({ title: "Select a child and a plan", variant: "destructive" });
      return;
    }
    setSubscribing(selectedPlan);
    try {
      const res = await subscriptionAPI.createOrder({
        studentId: selectedChild,
        planId: selectedPlan,
        billingCycle,
      });
      const order = res.data;

      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Failed to load Razorpay checkout. Check your connection.");

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount * 100,
          currency: order.currency || "INR",
          name: "NestSports",
          description: `${order.planName} — ${order.studentName}`,
          theme: { color: "#024BAB" },
          handler: async (response: any) => {
            try {
              await subscriptionAPI.verifyPayment({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              toast({ title: "Subscribed!", description: "Payment successful." });
              resolve();
            } catch (err: any) {
              reject(err);
            }
          },
          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
        });
        rzp.open();
      });
      load();
    } catch (e: any) {
      if (e.message !== "Payment cancelled") {
        toast({ title: "Payment failed", description: e.message, variant: "destructive" });
      }
    } finally {
      setSubscribing(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this subscription?")) return;
    try {
      await subscriptionAPI.cancel(id);
      toast({ title: "Subscription cancelled" });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    return subscriptions.filter((s) => {
      if (search) {
        const hay = `${s.student?.firstName || ""} ${s.student?.lastName || ""} ${s.planName || ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      if (filterStatus && s.status !== filterStatus) return false;
      if (filterCycle && s.billingCycle !== filterCycle) return false;
      return true;
    });
  }, [subscriptions, search, filterStatus, filterCycle]);

  const displayed = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "student") cmp = (a.student?.firstName || "").localeCompare(b.student?.firstName || "");
      else if (sortKey === "plan") cmp = (a.planName || "").localeCompare(b.planName || "");
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      else if (sortKey === "renewalDate") cmp = new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const activeCount = subscriptions.filter((s) => s.status === "active").length;
  const monthlyRevenue = subscriptions
    .filter((s) => s.status === "active" && s.billingCycle === "monthly")
    .reduce((sum, s) => sum + s.amount, 0);

  return (
    <AppLayout title="Subscriptions">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-black">Subscriptions</h1>
          <p className="text-sm text-muted-foreground font-medium mt-0.5">
            {isParent ? "Subscribe your child to a coaching plan" : "All active student subscriptions"}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Subscriptions</p>
            <p className="text-2xl font-bold text-black">{subscriptions.length}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00C48C]/10 border-2 border-[#00C48C] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-[#00C48C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active</p>
            <p className="text-2xl font-bold text-black">{activeCount}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Monthly Revenue</p>
            <p className="text-2xl font-bold text-black">₹{monthlyRevenue.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      {isParent && (
        <div className="bg-white border-2 border-black p-6 mb-6">
          <h3 className="font-bold text-base mb-4">Subscribe a Child</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Child</label>
              <select
                value={selectedChild}
                onChange={(e) => setSelectedChild(e.target.value)}
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
              >
                {children.map((c) => (
                  <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Plan</label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
              >
                <option value="">Choose a plan</option>
                {plans.map((p) => (
                  <option key={p._id} value={p._id}>{p.name} — ₹{p.monthlyPrice}/mo</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Billing Cycle</label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as any)}
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleSubscribe}
            disabled={!!subscribing}
            className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-60"
          >
            {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            Pay & Subscribe
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0" />
          <input
            type="text"
            placeholder="Search by student or plan..."
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
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="cancelled">Cancelled</option>
          <option value="pending_renewal">Pending Renewal</option>
        </select>
        <select
          value={filterCycle}
          onChange={(e) => setFilterCycle(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Cycles</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        {(search || filterStatus || filterCycle) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterStatus("");
              setFilterCycle("");
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
          <option value="renewalDate">Sort: Renewal Date</option>
          <option value="student">Sort: Student</option>
          <option value="plan">Sort: Plan</option>
          <option value="amount">Sort: Amount</option>
        </select>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold flex items-center gap-1"
        >
          {sortDir === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          {sortDir === "asc" ? "Asc" : "Desc"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <Wallet className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No subscriptions found</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {displayed.map((s) => {
              const m = STATUS_META[s.status] || STATUS_META.inactive;
              return (
                <div key={s._id} className="border-2 border-black bg-white p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-black">{s.student?.firstName} {s.student?.lastName}</p>
                      <p className="text-xs text-muted-foreground">{s.planName}</p>
                    </div>
                    <span className={cn("border-2 border-black/10 text-[10px] font-bold uppercase px-1.5 py-0.5 shrink-0", m.bg, m.text)}>
                      {s.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                    <div>
                      <span className="text-muted-foreground">Cycle: </span>
                      <span className="font-bold text-black capitalize">{s.billingCycle}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Amount: </span>
                      <span className="font-bold text-black">₹{s.amount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Renewal: </span>
                      <span className="font-bold text-black">{new Date(s.renewalDate).toLocaleDateString("en-IN")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Payment: </span>
                      {s.paymentStatus === "completed" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                    </div>
                  </div>
                  {s.status === "active" && (
                    <button
                      onClick={() => handleCancel(s._id)}
                      className="w-full border-2 border-black bg-white py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      Cancel Subscription
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block border-2 border-black bg-white overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-[#024BAB]/5">
                  {["Student", "Plan", "Cycle", "Amount", "Renewal", "Status", "Payment", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((s, idx) => {
                  const m = STATUS_META[s.status] || STATUS_META.inactive;
                  return (
                    <tr key={s._id} className={cn("border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors", idx % 2 === 0 ? "" : "bg-[#F8FAFF]")}>
                      <td className="px-4 py-3 font-bold text-black">{s.student?.firstName} {s.student?.lastName}</td>
                      <td className="px-4 py-3 text-black">{s.planName}</td>
                      <td className="px-4 py-3 text-black capitalize">{s.billingCycle}</td>
                      <td className="px-4 py-3 text-black font-medium">₹{s.amount}</td>
                      <td className="px-4 py-3 text-black">{new Date(s.renewalDate).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 border border-black/10", m.bg, m.text)}>{s.status.replace("_", " ")}</span>
                      </td>
                      <td className="px-4 py-3">
                        {s.paymentStatus === "completed" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.status === "active" && (
                          <button
                            onClick={() => handleCancel(s._id)}
                            className="text-xs font-bold text-red-500 hover:underline"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}
