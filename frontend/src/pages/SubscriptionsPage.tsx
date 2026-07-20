import { useState, useEffect, useCallback, useMemo } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  subscriptionAPI,
  sportsPlanAPI,
  studentAPI,
  settingsAPI,
  getToken,
} from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ImportExportModal,
  type ImportHeader,
} from "@/components/ImportExportModal";
import { exportRowsToExcel } from "@/utils/excelImportExport";
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
  QrCode,
  Upload,
  Eye,
  Download,
  FileSpreadsheet,
  FileText,
  Banknote,
  Check,
} from "lucide-react";

const SUBSCRIPTION_IMPORT_HEADERS: ImportHeader[] = [
  { key: "studentId", label: "Student ID", required: true, example: "STU0001" },
  {
    key: "planName",
    label: "Plan Name",
    required: true,
    example: "Elite Tennis",
  },
  {
    key: "billingCycle",
    label: "Billing Cycle",
    required: true,
    example: "monthly",
  },
  { key: "amount", label: "Amount", required: false, example: "2500" },
  {
    key: "startDate",
    label: "Start Date",
    required: false,
    example: "2024-01-15",
  },
  {
    key: "renewalDate",
    label: "Renewal Date",
    required: false,
    example: "2024-02-15",
  },
  { key: "status", label: "Status", required: false, example: "active" },
  {
    key: "paymentMethod",
    label: "Payment Method",
    required: false,
    example: "razorpay",
  },
];

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentEntry {
  _id: string;
  amount: number;
  method: "qr" | "razorpay" | "cash";
  utrNumber?: string;
  transactionNumber?: string;
  screenshot?: string;
  status: "pending" | "verified" | "rejected";
  submittedAt: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

interface Subscription {
  _id: string;
  student: {
    _id: string;
    firstName: string;
    lastName: string;
    studentId?: string;
  };
  plan: { _id: string; name: string };
  planName: string;
  billingCycle: string;
  amount: number;
  amountPaid: number;
  renewalDate: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  payments: PaymentEntry[];
  rejectionReason?: string;
}

const STATUS_META: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-green-50", text: "text-green-700" },
  inactive: { bg: "bg-gray-50", text: "text-gray-500" },
  cancelled: { bg: "bg-red-50", text: "text-red-600" },
  pending_renewal: { bg: "bg-yellow-50", text: "text-yellow-700" },
};

const PAYMENT_STATUS_META: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  completed: { bg: "bg-green-50", text: "text-green-700", label: "Completed" },
  partial: { bg: "bg-purple-50", text: "text-purple-700", label: "Partial" },
  pending: { bg: "bg-yellow-50", text: "text-yellow-700", label: "Pending" },
  rejected: { bg: "bg-red-50", text: "text-red-600", label: "Rejected" },
  failed: { bg: "bg-red-50", text: "text-red-600", label: "Failed" },
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
  const [importModal, setImportModal] = useState(false);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  const [selectedChild, setSelectedChild] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );

  const [paymentQrUrl, setPaymentQrUrl] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);
  // Set when "Pay Remaining" is clicked on an existing subscription with a
  // balance due — routes the submission to the top-up endpoint instead of
  // the first-payment (qr-renewal) one.
  const [qrTopUpSub, setQrTopUpSub] = useState<Subscription | null>(null);
  const [qrAmount, setQrAmount] = useState("");
  const [qrMethod, setQrMethod] = useState<"qr" | "cash">("qr");
  const [qrReferenceNumber, setQrReferenceNumber] = useState("");
  const [qrTransactionNumber, setQrTransactionNumber] = useState("");
  const [qrScreenshot, setQrScreenshot] = useState<File | null>(null);
  const [submittingQr, setSubmittingQr] = useState(false);

  const [reviewSub, setReviewSub] = useState<Subscription | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Owner/staff recording a payment received in cash — no pending-review
  // step, verified immediately. cashTopUpSub set = topping up an existing
  // subscription; null = recording a brand-new one for a walk-in.
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashTopUpSub, setCashTopUpSub] = useState<Subscription | null>(null);
  const [cashStudentSearch, setCashStudentSearch] = useState("");
  const [cashStudentResults, setCashStudentResults] = useState<any[]>([]);
  const [cashStudent, setCashStudent] = useState<any | null>(null);
  const [cashPlanId, setCashPlanId] = useState("");
  const [cashBillingCycle, setCashBillingCycle] = useState<
    "monthly" | "yearly"
  >("monthly");
  const [cashAmount, setCashAmount] = useState("");
  const [submittingCash, setSubmittingCash] = useState(false);

  // At most one payment entry is ever pending at a time — the backend
  // rejects a new submission while one is awaiting review.
  const reviewPayment = reviewSub?.payments?.find(
    (p) => p.status === "pending",
  );

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCycle, setFilterCycle] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("renewalDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // "student"/"plan" sort keys aren't backend-sortable (populated refs, not
  // scalar fields) — only renewalDate/amount get pushed server-side.
  const subParams = useCallback(
    (pageNum: number): Record<string, string> => {
      const params: Record<string, string> = {
        page: String(pageNum),
        limit: "20",
      };
      if (filterStatus) params.status = filterStatus;
      if (filterCycle) params.billingCycle = filterCycle;
      if (sortKey === "amount" || sortKey === "renewalDate") {
        params.sortBy = sortKey;
        params.sortDir = sortDir;
      }
      return params;
    },
    [filterStatus, filterCycle, sortKey, sortDir],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, planRes] = await Promise.all([
        subscriptionAPI.getAll(subParams(1)),
        sportsPlanAPI.getAll(),
      ]);
      setSubscriptions(subRes.data);
      setPage(1);
      setPages(subRes.pages || 1);
      setTotal(subRes.total ?? subRes.data.length);
      setPlans(planRes.data);
      if (isParent) {
        const studRes = await studentAPI.getAll();
        setChildren(studRes.data);
        if (studRes.data[0]) setSelectedChild(studRes.data[0]._id);
        const settingsRes = await settingsAPI.get();
        const qrPath = settingsRes.data?.paymentQrUrl;
        setPaymentQrUrl(
          qrPath
            ? `${import.meta.env.VITE_API_URL?.replace(/\/api$/, "")}${qrPath}`
            : "",
        );
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [isParent, subParams]);

  const loadMoreSubs = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await subscriptionAPI.getAll(subParams(next));
      setSubscriptions((p) => [...p, ...r.data]);
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
      if (!loaded)
        throw new Error(
          "Failed to load Razorpay checkout. Check your connection.",
        );

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
              toast({
                title: "Subscribed!",
                description: "Payment successful.",
              });
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
        toast({
          title: "Payment failed",
          description: e.message,
          variant: "destructive",
        });
      }
    } finally {
      setSubscribing(null);
    }
  };

  const handleSubmitQrPayment = async () => {
    const isTopUp = !!qrTopUpSub;
    if (!isTopUp && (!selectedChild || !selectedPlan)) {
      toast({ title: "Select a child and a plan", variant: "destructive" });
      return;
    }
    const amount = Number(qrAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Enter a valid amount to pay", variant: "destructive" });
      return;
    }
    if (qrMethod === "qr") {
      if (!qrReferenceNumber.trim()) {
        toast({
          title: "Enter the UTR number",
          variant: "destructive",
        });
        return;
      }
      if (!qrTransactionNumber.trim()) {
        toast({
          title: "Enter the transaction number",
          variant: "destructive",
        });
        return;
      }
      if (!qrScreenshot) {
        toast({
          title: "Upload a screenshot of the payment",
          variant: "destructive",
        });
        return;
      }
    }
    setSubmittingQr(true);
    try {
      if (isTopUp) {
        await subscriptionAPI.submitPayment(qrTopUpSub!._id, {
          method: qrMethod,
          referenceNumber: qrReferenceNumber.trim() || undefined,
          transactionNumber: qrTransactionNumber.trim() || undefined,
          amount,
          screenshot: qrScreenshot || undefined,
        });
      } else {
        await subscriptionAPI.qrRenewal({
          studentId: selectedChild,
          planId: selectedPlan,
          billingCycle,
          method: qrMethod,
          referenceNumber: qrReferenceNumber.trim() || undefined,
          transactionNumber: qrTransactionNumber.trim() || undefined,
          amount,
          screenshot: qrScreenshot || undefined,
        });
      }
      toast({
        title: "Submitted",
        description: "Waiting for the club to verify your payment.",
      });
      setShowQrModal(false);
      setQrTopUpSub(null);
      setQrAmount("");
      setQrMethod("qr");
      setQrReferenceNumber("");
      setQrTransactionNumber("");
      setQrScreenshot(null);
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmittingQr(false);
    }
  };

  const openPayRemaining = (sub: Subscription) => {
    setQrTopUpSub(sub);
    setQrAmount(String(sub.amount - (sub.amountPaid || 0)));
    setQrMethod("qr");
    setShowQrModal(true);
  };

  const handleVerifyPayment = async () => {
    if (!reviewSub || !reviewPayment) return;
    setReviewing(true);
    try {
      await subscriptionAPI.verifyQrPayment(reviewSub._id, reviewPayment._id);
      toast({ title: "Payment verified" });
      setReviewSub(null);
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setReviewing(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!reviewSub || !reviewPayment) return;
    setReviewing(true);
    try {
      await subscriptionAPI.rejectQrPayment(reviewSub._id, reviewPayment._id);
      toast({
        title: "Marked as not verified",
        description: "The parent can resubmit a new payment.",
      });
      setReviewSub(null);
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setReviewing(false);
    }
  };

  const handleDownloadReceipt = async (subId: string, paymentId: string) => {
    setDownloadingId(paymentId);
    try {
      const token = getToken();
      const res = await fetch(subscriptionAPI.receiptUrl(subId, paymentId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to download receipt");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt_${paymentId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const openCashModalNew = () => {
    setCashTopUpSub(null);
    setCashStudentSearch("");
    setCashStudentResults([]);
    setCashStudent(null);
    setCashPlanId("");
    setCashBillingCycle("monthly");
    setCashAmount("");
    setShowCashModal(true);
  };

  const openCashModalTopUp = (sub: Subscription) => {
    setCashTopUpSub(sub);
    setCashAmount(String(sub.amount - (sub.amountPaid || 0)));
    setShowCashModal(true);
  };

  const searchCashStudents = async (q: string) => {
    setCashStudentSearch(q);
    setCashStudent(null);
    if (!q.trim()) {
      setCashStudentResults([]);
      return;
    }
    try {
      const r = await studentAPI.getAll({ search: q, limit: "10" });
      setCashStudentResults(r.data || []);
    } catch {
      // ignore — user can retry by typing again
    }
  };

  const handleSubmitCash = async () => {
    const isTopUp = !!cashTopUpSub;
    if (!isTopUp && !cashStudent) {
      toast({ title: "Select a student", variant: "destructive" });
      return;
    }
    if (!isTopUp && !cashPlanId) {
      toast({ title: "Select a plan", variant: "destructive" });
      return;
    }
    const amount = Number(cashAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setSubmittingCash(true);
    try {
      if (isTopUp) {
        await subscriptionAPI.recordCashTopUp(cashTopUpSub!._id, amount);
      } else {
        await subscriptionAPI.recordCashSubscription({
          studentId: cashStudent._id,
          planId: cashPlanId,
          billingCycle: cashBillingCycle,
          amount,
        });
      }
      toast({ title: "Cash payment recorded" });
      setShowCashModal(false);
      setCashTopUpSub(null);
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmittingCash(false);
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

  // status/billingCycle/amount/renewalDate are already applied server-side
  // (subParams); search and student/plan sort stay client-side since the
  // backend can't filter/sort on populated ref fields.
  const filtered = useMemo(() => {
    if (!search) return subscriptions;
    return subscriptions.filter((s) => {
      const hay =
        `${s.student?.firstName || ""} ${s.student?.lastName || ""} ${s.planName || ""}`.toLowerCase();
      return hay.includes(search.toLowerCase());
    });
  }, [subscriptions, search]);

  const displayed = useMemo(() => {
    if (sortKey !== "student" && sortKey !== "plan") return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const cmp =
        sortKey === "student"
          ? (a.student?.firstName || "").localeCompare(
              b.student?.firstName || "",
            )
          : (a.planName || "").localeCompare(b.planName || "");
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
          <h1 className="font-display font-bold text-2xl text-black">
            Subscriptions
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-0.5">
            {isParent
              ? "Subscribe your child to a coaching plan"
              : "All active student subscriptions"}
          </p>
        </div>
        {!isParent && (
          <div className="flex items-center gap-2">
            <button
              onClick={openCashModalNew}
              className="border-2 border-black bg-[#00C48C] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:opacity-90 transition-opacity"
            >
              <Banknote className="w-4 h-4" /> Record Cash Payment
            </button>
            <button
              onClick={() =>
                exportRowsToExcel(
                  SUBSCRIPTION_IMPORT_HEADERS.map((h) => ({
                    key: h.key,
                    label: h.label,
                  })),
                  displayed.map((s) => ({
                    studentId: s.student?.studentId || "",
                    planName: s.planName,
                    billingCycle: s.billingCycle,
                    amount: s.amount,
                    renewalDate: s.renewalDate?.slice(0, 10),
                    status: s.status,
                    paymentMethod: s.paymentMethod,
                  })),
                  "subscriptions_export.xlsx",
                  "Subscriptions",
                )
              }
              className="border-2 border-black bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              onClick={() => setImportModal(true)}
              className="border-2 border-black bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-gray-50 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" /> Import Excel
            </button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Subscriptions
            </p>
            <p className="text-2xl font-bold text-black">
              {subscriptions.length}
            </p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00C48C]/10 border-2 border-[#00C48C] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-[#00C48C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Active
            </p>
            <p className="text-2xl font-bold text-black">{activeCount}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Monthly Revenue
            </p>
            <p className="text-2xl font-bold text-black">
              ₹{monthlyRevenue.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      {isParent && (
        <div className="bg-white border-2 border-black p-6 mb-6">
          <h3 className="font-bold text-base mb-4">Subscribe a Child</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Child
              </label>
              <select
                value={selectedChild}
                onChange={(e) => setSelectedChild(e.target.value)}
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
              >
                {children.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Plan
              </label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
              >
                <option value="">Choose a plan</option>
                {plans.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} — ₹{p.monthlyPrice}/mo
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Billing Cycle
              </label>
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
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSubscribe}
              disabled={!!subscribing}
              className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-60"
            >
              {subscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wallet className="w-4 h-4" />
              )}
              Pay & Subscribe
            </button>
            {paymentQrUrl && (
              <button
                onClick={() => {
                  setQrTopUpSub(null);
                  const plan = plans.find((p) => p._id === selectedPlan);
                  const amount = plan
                    ? billingCycle === "yearly"
                      ? plan.yearlyPrice
                      : plan.monthlyPrice
                    : 0;
                  setQrAmount(amount ? String(amount) : "");
                  setQrMethod("qr");
                  setShowQrModal(true);
                }}
                className="flex items-center gap-2 bg-white text-black border-2 border-black px-4 py-2 font-bold text-sm uppercase"
              >
                <QrCode className="w-4 h-4" />
                Pay via QR
              </button>
            )}
          </div>
        </div>
      )}

      {showQrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-black w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">
                {qrTopUpSub ? "Pay Remaining Balance" : "Pay via QR"}
              </h3>
              <button
                onClick={() => {
                  setShowQrModal(false);
                  setQrTopUpSub(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQrMethod("qr")}
                className={cn(
                  "border-2 border-black px-3 py-2 text-xs font-bold uppercase",
                  qrMethod === "qr"
                    ? "bg-[#024BAB] text-white"
                    : "bg-white text-black",
                )}
              >
                UPI
              </button>
              <button
                type="button"
                onClick={() => setQrMethod("cash")}
                className={cn(
                  "border-2 border-black px-3 py-2 text-xs font-bold uppercase",
                  qrMethod === "cash"
                    ? "bg-[#024BAB] text-white"
                    : "bg-white text-black",
                )}
              >
                Cash
              </button>
            </div>
            {qrMethod === "qr" ? (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  Scan the QR code below, complete the payment, then submit the
                  UPI reference number along with a screenshot of the payment.
                </p>
                <img
                  src={paymentQrUrl}
                  alt="Payment QR"
                  className="w-48 h-48 object-contain border-2 border-black mx-auto mb-4"
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">
                Paid the club in cash? Enter the amount below — the club will
                verify it once they've received the cash.
              </p>
            )}
            <div className="mb-3">
              <label className="block text-xs font-bold uppercase mb-1">
                Amount to Pay
              </label>
              <input
                type="number"
                value={qrAmount}
                onChange={(e) => setQrAmount(e.target.value)}
                placeholder="e.g. 800"
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
              />
            </div>
            {qrMethod === "qr" && (
              <>
                <div className="mb-3">
                  <label className="block text-xs font-bold uppercase mb-1">
                    UTR Number
                  </label>
                  <input
                    type="text"
                    value={qrReferenceNumber}
                    onChange={(e) => setQrReferenceNumber(e.target.value)}
                    placeholder="e.g. 123456789012"
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-bold uppercase mb-1">
                    Transaction Number
                  </label>
                  <input
                    type="text"
                    value={qrTransactionNumber}
                    onChange={(e) => setQrTransactionNumber(e.target.value)}
                    placeholder="e.g. TXN20250117001"
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase mb-1">
                    Payment Screenshot
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) =>
                      setQrScreenshot(e.target.files?.[0] || null)
                    }
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                  />
                </div>
              </>
            )}
            <button
              onClick={handleSubmitQrPayment}
              disabled={submittingQr}
              className="w-full flex items-center justify-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-60"
            >
              {submittingQr ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Submit Payment
            </button>
          </div>
        </div>
      )}

      {showCashModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-black w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">Record Cash Payment</h3>
              <button
                onClick={() => {
                  setShowCashModal(false);
                  setCashTopUpSub(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {cashTopUpSub ? (
              <p className="text-sm text-muted-foreground mb-3">
                For {cashTopUpSub.student?.firstName}{" "}
                {cashTopUpSub.student?.lastName} — {cashTopUpSub.planName}
              </p>
            ) : (
              <>
                <div className="mb-3 relative">
                  <label className="block text-xs font-bold uppercase mb-1">
                    Student
                  </label>
                  {cashStudent ? (
                    <div className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-[#F8FAFF] flex items-center justify-between">
                      <span>
                        {cashStudent.firstName} {cashStudent.lastName}
                      </span>
                      <button onClick={() => setCashStudent(null)}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={cashStudentSearch}
                        onChange={(e) => searchCashStudents(e.target.value)}
                        placeholder="Search by name or student ID..."
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                      />
                      {cashStudentResults.length > 0 && (
                        <div className="absolute z-10 left-0 right-0 border-2 border-t-0 border-black bg-white max-h-40 overflow-y-auto">
                          {cashStudentResults.map((s) => (
                            <button
                              key={s._id}
                              onClick={() => {
                                setCashStudent(s);
                                setCashStudentResults([]);
                              }}
                              className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-[#024BAB]/5 border-b border-black/10 last:border-b-0"
                            >
                              {s.firstName} {s.lastName}
                              {s.studentId ? ` (${s.studentId})` : ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-bold uppercase mb-1">
                    Plan
                  </label>
                  <select
                    value={cashPlanId}
                    onChange={(e) => {
                      setCashPlanId(e.target.value);
                      const plan = plans.find((p) => p._id === e.target.value);
                      if (plan) {
                        setCashAmount(
                          String(
                            cashBillingCycle === "yearly"
                              ? plan.yearlyPrice
                              : plan.monthlyPrice,
                          ),
                        );
                      }
                    }}
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                  >
                    <option value="">Choose a plan</option>
                    {plans.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} — ₹{p.monthlyPrice}/mo
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-bold uppercase mb-1">
                    Billing Cycle
                  </label>
                  <select
                    value={cashBillingCycle}
                    onChange={(e) => {
                      const cycle = e.target.value as "monthly" | "yearly";
                      setCashBillingCycle(cycle);
                      const plan = plans.find((p) => p._id === cashPlanId);
                      if (plan) {
                        setCashAmount(
                          String(
                            cycle === "yearly"
                              ? plan.yearlyPrice
                              : plan.monthlyPrice,
                          ),
                        );
                      }
                    }}
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </>
            )}
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase mb-1">
                Amount Received
              </label>
              <input
                type="number"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="e.g. 2000"
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
              />
            </div>
            <button
              onClick={handleSubmitCash}
              disabled={submittingCash}
              className="w-full flex items-center justify-center gap-2 bg-[#00C48C] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-60"
            >
              {submittingCash ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Banknote className="w-4 h-4" />
              )}
              Record Payment
            </button>
          </div>
        </div>
      )}

      {reviewSub && reviewPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-black w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">Review Payment</h3>
              <button onClick={() => setReviewSub(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">
                  Student
                </span>
                <span className="font-bold text-black">
                  {reviewSub.student?.firstName} {reviewSub.student?.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Plan</span>
                <span className="font-bold text-black">
                  {reviewSub.planName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">
                  Amount
                </span>
                <span className="font-bold text-black">
                  ₹{reviewPayment.amount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">
                  Method
                </span>
                <span className="font-bold text-black">
                  {reviewPayment.method === "cash"
                    ? "Cash (self-declared)"
                    : "UPI"}
                </span>
              </div>
              {reviewPayment.method !== "cash" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">
                      UTR Number
                    </span>
                    <span className="font-bold text-black">
                      {reviewPayment.utrNumber || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">
                      Transaction Number
                    </span>
                    <span className="font-bold text-black">
                      {reviewPayment.transactionNumber || "—"}
                    </span>
                  </div>
                </>
              )}
            </div>
            {reviewPayment.method !== "cash" && reviewPayment.screenshot ? (
              <a
                href={reviewPayment.screenshot}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={reviewPayment.screenshot}
                  alt="Payment screenshot"
                  className="w-full max-h-72 object-contain border-2 border-black mb-4"
                />
              </a>
            ) : (
              <p className="text-xs text-muted-foreground mb-4">
                {reviewPayment.method === "cash"
                  ? "Self-declared cash payment — confirm you've received the cash before verifying."
                  : "No screenshot uploaded."}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleVerifyPayment}
                disabled={reviewing}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-60"
              >
                {reviewing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Verified
              </button>
              <button
                onClick={handleRejectPayment}
                disabled={reviewing}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-60"
              >
                {reviewing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Not Verified
              </button>
            </div>
          </div>
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
          {sortDir === "asc" ? (
            <ArrowUp className="w-4 h-4" />
          ) : (
            <ArrowDown className="w-4 h-4" />
          )}
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
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <>
          {/* Table (scrolls horizontally on small screens) */}
          <div className="border-2 border-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-[#024BAB]/5">
                  {[
                    "Student",
                    "Plan",
                    "Cycle",
                    "Amount",
                    "Renewal",
                    "Status",
                    "Payment",
                    "Actions",
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
                {displayed.map((s, idx) => {
                  const m = STATUS_META[s.status] || STATUS_META.inactive;
                  return (
                    <tr
                      key={s._id}
                      className={cn(
                        "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                        idx % 2 === 0 ? "" : "bg-[#F8FAFF]",
                      )}
                    >
                      <td className="px-4 py-3 font-bold text-black">
                        {s.student?.firstName} {s.student?.lastName}
                      </td>
                      <td className="px-4 py-3 text-black">{s.planName}</td>
                      <td className="px-4 py-3 text-black capitalize">
                        {s.billingCycle}
                      </td>
                      <td className="px-4 py-3 text-black font-medium">
                        ₹{s.amountPaid || 0} / ₹{s.amount}
                      </td>
                      <td className="px-4 py-3 text-black">
                        {new Date(s.renewalDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase px-1.5 py-0.5 border border-black/10",
                            m.bg,
                            m.text,
                          )}
                        >
                          {s.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const pm =
                            PAYMENT_STATUS_META[s.paymentStatus] ||
                            PAYMENT_STATUS_META.pending;
                          return (
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase px-1.5 py-0.5 border border-black/10",
                                pm.bg,
                                pm.text,
                              )}
                            >
                              {pm.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          {!isParent &&
                            s.payments?.some((p) => p.status === "pending") && (
                              <button
                                onClick={() => setReviewSub(s)}
                                className="flex items-center gap-1 text-xs font-bold text-[#024BAB] hover:underline"
                              >
                                <Eye className="w-3.5 h-3.5" /> Review
                              </button>
                            )}
                          {!isParent &&
                            s.status !== "cancelled" &&
                            (s.amountPaid || 0) < s.amount &&
                            !s.payments?.some(
                              (p) => p.status === "pending",
                            ) && (
                              <button
                                onClick={() => openCashModalTopUp(s)}
                                className="flex items-center gap-1 text-xs font-bold text-[#00C48C] hover:underline"
                              >
                                <Banknote className="w-3.5 h-3.5" /> Record Cash
                                Payment
                              </button>
                            )}
                          {isParent &&
                            s.status !== "active" &&
                            s.status !== "cancelled" &&
                            !s.payments?.some((p) => p.status === "pending") &&
                            (s.amountPaid || 0) < s.amount && (
                              <button
                                onClick={() => openPayRemaining(s)}
                                className="flex items-center gap-1 text-xs font-bold text-[#024BAB] hover:underline"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                {s.amountPaid > 0
                                  ? "Pay Remaining"
                                  : "Pay via QR"}
                              </button>
                            )}
                          {s.payments
                            ?.filter((p) => p.status === "verified")
                            .map((p) => (
                              <div
                                key={p._id}
                                className="flex items-center gap-2"
                              >
                                <button
                                  onClick={() =>
                                    handleDownloadReceipt(s._id, p._id)
                                  }
                                  disabled={downloadingId === p._id}
                                  className="flex items-center gap-1 text-xs font-bold text-green-700 hover:underline disabled:opacity-60"
                                >
                                  <FileText className="w-3.5 h-3.5" /> Receipt
                                  (₹{p.amount})
                                </button>
                                <span className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                                  <span className="flex items-center gap-0.5">
                                    {p.method === "cash" && (
                                      <Check className="w-3 h-3 text-[#00C48C]" />
                                    )}
                                    Cash
                                  </span>
                                  <span className="flex items-center gap-0.5">
                                    {p.method !== "cash" && (
                                      <Check className="w-3 h-3 text-[#024BAB]" />
                                    )}
                                    UPI
                                  </span>
                                </span>
                              </div>
                            ))}
                          {s.status === "active" && (
                            <button
                              onClick={() => handleCancel(s._id)}
                              className="text-xs font-bold text-red-500 hover:underline"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {page < pages && (
            <div className="flex flex-col items-center gap-2 mt-4">
              <p className="text-xs text-muted-foreground">
                Showing {subscriptions.length} of {total}
              </p>
              <button
                onClick={loadMoreSubs}
                disabled={loadingMore}
                className="border-2 border-black bg-white px-4 py-2 text-sm font-bold uppercase hover:bg-[#024BAB]/5 disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
      <ImportExportModal
        open={importModal}
        onClose={() => setImportModal(false)}
        entityLabel="Subscription"
        headers={SUBSCRIPTION_IMPORT_HEADERS}
        templateFilename="subscriptions_import_template.xlsx"
        notes={
          <>
            <p>
              • <strong>Student ID</strong> must exactly match a student's ID
              (e.g. <code>STU0001</code>) from the Students page.
            </p>
            <p>
              • <strong>Plan Name</strong> must exactly match an existing
              coaching plan.
            </p>
            <p>
              • <strong>Billing Cycle</strong> must be <code>monthly</code> or{" "}
              <code>yearly</code>. This creates the subscription as already paid
              — for backfilling historical records only.
            </p>
            <p>
              • Maximum <strong>200 subscriptions</strong> per import.
            </p>
          </>
        }
        previewColumns={[
          { key: "studentId", label: "Student ID" },
          { key: "planName", label: "Plan" },
          { key: "billingCycle", label: "Billing Cycle" },
          { key: "amount", label: "Amount" },
        ]}
        onImport={(rows) => subscriptionAPI.bulkImport(rows) as any}
        onImported={load}
      />
    </AppLayout>
  );
}
