import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { billingAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { buildInvoiceHTML } from "@/lib/buildInvoiceHTML";
import {
  Check,
  CreditCard,
  Crown,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Users,
  Calendar,
  Building2,
  Zap,
  Download,
  X,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type Tier = "web" | "web_mobile" | "web_mobile_whatsapp";

const PLANS: { tier: Tier; name: string; rate: number }[] = [
  { tier: "web", name: "Web", rate: 500 },
  { tier: "web_mobile", name: "Web + Mobile", rate: 700 },
  { tier: "web_mobile_whatsapp", name: "Web + Mobile + WhatsApp", rate: 800 },
];

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedTier, setSelectedTier] = useState<Tier>("web_mobile");
  const [subscription, setSubscription] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [newEmployeeCount, setNewEmployeeCount] = useState<number | "">("");
  const [gatewayModal, setGatewayModal] = useState(false);

  useEffect(() => {
    Promise.all([
      billingAPI
        .getSubscription()
        .then((r) => {
          if (r.success) {
            setSubscription(r.data);
            setNewEmployeeCount(r.data.maxEmployees || "");
            if (r.data.tier) setSelectedTier(r.data.tier);
          }
        })
        .catch(() => {}),
      billingAPI
        .getInvoices()
        .then((r) => {
          if (r.success) setInvoices(r.data);
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const sub = subscription || user?.company?.subscription;
  const currentPlanId = sub?.plan || "1-10 employees";

  const currentPlan = {
    name: currentPlanId,
    monthlyPrice: sub?.monthlyPrice || 0,
    yearlyPrice: sub?.yearlyPrice || 0,
    maxEmployees: sub?.maxEmployees || 0,
  };

  const empUsed = sub?.currentEmployeeCount ?? 0;
  const empMax = sub?.maxEmployees ?? currentPlan.maxEmployees ?? 0;
  const empPct =
    empMax > 0 ? Math.min(Math.round((empUsed / empMax) * 100), 100) : 0;

  const isTrial = sub?.isTrial ?? false;
  const trialEndDate = sub?.trialEndDate ? new Date(sub.trialEndDate) : null;
  const renewalDate = sub?.renewalDate ? new Date(sub.renewalDate) : null;
  const expiryDate = isTrial ? trialEndDate : renewalDate;
  const daysLeft = expiryDate
    ? Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / 86400000))
    : null;
  const totalDays = isTrial ? 60 : sub?.billingCycle === "yearly" ? 365 : 30;
  const daysPct =
    daysLeft != null
      ? Math.min(Math.round((daysLeft / totalDays) * 100), 100)
      : 100;

  const isActive =
    sub?.status === "active" || sub?.status === "pending_renewal";

  const loadRazorpayScript = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  const handleDownloadInvoice = (inv: any) => {
    setDownloading(inv._id);
    try {
      const html = buildInvoiceHTML(inv);
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
        setTimeout(() => {
          w.print();
        }, 500);
      }
    } finally {
      setDownloading(null);
    }
  };

  const handleUpdateTeamSize = () => {
    const count = Number(newEmployeeCount);
    if (!count || count < 1) {
      toast({
        title: "Enter employee count",
        description: "How many employees should this plan cover?",
        variant: "destructive",
      });
      return;
    }
    setGatewayModal(true);
  };

  const handleGatewaySelect = async (gateway: "razorpay" | "hdfc") => {
    const count = Number(newEmployeeCount);
    if (!count) return;
    setGatewayModal(false);
    setUpgrading(true);
    try {
      const res = await billingAPI.createOrder(
        count,
        selectedTier,
        "yearly",
        gateway,
      );
      if (!res.success) throw new Error("Failed to create order");
      const order = res.data;

      if (gateway === "razorpay") {
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
            description: `NestSports — ${count} employees — ${order.plan}`,
            prefill: {
              name: order.userName,
              email: order.userEmail,
              contact: order.userPhone,
            },
            theme: { color: "#024BAB" },
            handler: async (response: any) => {
              try {
                await billingAPI.verifyRazorpay({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                });
                toast({
                  title: "Payment Successful!",
                  description: "Subscription updated.",
                });
                resolve();
              } catch (err: any) {
                reject(err);
              }
            },
            modal: {
              ondismiss: () => reject(new Error("Payment cancelled")),
            },
          });
          rzp.open();
        });
      } else {
        if (!order.paymentUrl)
          throw new Error("HDFC did not return a payment URL.");
        window.location.href = order.paymentUrl;
      }
    } catch (err: any) {
      if (err.message !== "Payment cancelled") {
        toast({
          title: "Payment Error",
          description: err.message || "Failed to process payment",
          variant: "destructive",
        });
      }
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Billing">
        <div className="flex items-center justify-center h-[60vh]">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Billing">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6">
        {}
        {isTrial && (
          <div className="border-2 border-[#FBBF24] bg-[#FBBF24]/10 p-4 flex items-start gap-3">
            <Zap className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#D97706] text-sm">
                2-Month Free Trial Active — {daysLeft ?? 0} days remaining
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You're on a free trial until{" "}
                {trialEndDate?.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                . Subscribe anytime below to keep full access and unlock yearly
                savings.
              </p>
            </div>
          </div>
        )}
        {!isActive && !isTrial && (
          <div className="border-2 border-[#EF4444] bg-[#EF4444]/5 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#EF4444] text-sm">
                No Active Subscription
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your account is not yet activated. Choose a plan below to start
                using NestSports.
              </p>
            </div>
          </div>
        )}

        {}
        <div className="border-2 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#024BAB]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-[#024BAB]" />
            </div>
            <div>
              <p className="font-display font-bold text-white text-lg">
                {currentPlan.name} Plan —{" "}
                {isTrial ? "Free Trial" : isActive ? "Active" : "Inactive"}
              </p>
              <p className="text-sm font-medium text-white/70">
                {isTrial && trialEndDate
                  ? `Trial ends: ${trialEndDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
                  : renewalDate
                    ? `Next billing: ${renewalDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
                    : "No active subscription"}
              </p>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 border-2 border-black font-bold text-sm",
              isTrial
                ? "bg-[#FBBF24] text-black"
                : isActive
                  ? "bg-white text-[#024BAB]"
                  : "bg-[#EF4444] text-white",
            )}
          >
            {isTrial ? (
              <Zap className="w-4 h-4" />
            ) : isActive ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            {isTrial
              ? `${daysLeft ?? 0} days left`
              : isActive
                ? "Paid & Active"
                : "Attention Required"}
          </div>
        </div>

        {}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Employees",
              value: empUsed,
              max: empMax === 999 ? "∞" : empMax,
              pct: empMax === 999 ? 10 : empPct,
              icon: Users,
            },
            {
              label: "Days Remaining",
              value: daysLeft ?? "—",
              max: totalDays,
              pct: daysPct,
              icon: Calendar,
            },
            {
              label: "Plan Limit",
              value: empMax === 999 ? "Unlimited" : `${empMax} emp`,
              max: "",
              pct: 100,
              icon: Building2,
            },
          ].map((stat) => (
            <div key={stat.label} className="border-2 p-4 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4 text-[#024BAB] shrink-0" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </p>
              </div>
              <p className="font-display font-bold text-2xl text-black mb-2">
                {stat.value}
                {stat.max !== "" && (
                  <span className="text-sm font-medium text-muted-foreground ml-1">
                    / {stat.max}
                  </span>
                )}
              </p>
              <div className="h-2 bg-[#024BAB]/20 border border-black">
                <div
                  className={cn(
                    "h-full border-r border-black",
                    stat.pct > 85 ? "bg-[#EF4444]" : "bg-[#024BAB]",
                  )}
                  style={{ width: `${stat.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {}
        <div>
          <h2 className="font-display font-bold text-2xl text-black mb-6">
            Change Plan
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 max-w-2xl">
            {PLANS.map((p) => {
              const isSelected = selectedTier === p.tier;
              return (
                <button
                  key={p.tier}
                  onClick={() => setSelectedTier(p.tier)}
                  className={cn(
                    "text-left border-2 bg-white p-4 transition-all",
                    isSelected
                      ? "border-[#024BAB] ring-2 ring-[#024BAB]"
                      : "border-black hover:border-[#024BAB]",
                  )}
                >
                  <p className="font-bold text-sm text-black">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ₹{p.rate}/employee/year
                  </p>
                </button>
              );
            })}
          </div>

          <div className="border-2 p-5 bg-white max-w-sm">
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-2">
              Number of employees
            </label>
            <input
              type="number"
              min={1}
              value={newEmployeeCount}
              onChange={(e) =>
                setNewEmployeeCount(
                  e.target.value === ""
                    ? ""
                    : Math.max(1, parseInt(e.target.value) || 1),
                )
              }
              className="w-full border-2 border-black px-4 py-2.5 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#024BAB] mb-4"
            />

            {Number(newEmployeeCount) > 0 && (
              <div className="mb-4">
                {(() => {
                  const count = Number(newEmployeeCount);
                  const plan = PLANS.find((p) => p.tier === selectedTier)!;
                  const yearly = count * plan.rate;
                  return (
                    <>
                      <span className="font-display font-bold text-3xl text-black">
                        ₹{yearly.toLocaleString("en-IN")}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">
                        /yr
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        ₹{plan.rate}/employee/year · {plan.name}
                      </p>
                    </>
                  );
                })()}
              </div>
            )}

            <button
              onClick={handleUpdateTeamSize}
              disabled={
                upgrading ||
                (Number(newEmployeeCount) === empMax &&
                  selectedTier === sub?.tier)
              }
              className="border-2 w-full py-2.5 text-sm flex items-center justify-center gap-2 bg-black text-white hover:bg-black/80 disabled:opacity-50"
            >
              {upgrading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Update & Pay
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {}
        <div className="border-2 p-4 sm:p-5 bg-white">
          <h3 className="font-display font-bold text-lg text-black mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#024BAB]" /> Payment Method
          </h3>
          {sub?.paymentMethod ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border-2 border-black bg-[#024BAB]/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-7 bg-black flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-xs uppercase">
                    {sub.paymentMethod}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-sm text-black capitalize">
                    {sub.paymentMethod} — last payment ₹
                    {sub.amountPaid?.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Paid on{" "}
                    {sub.startDate
                      ? new Date(sub.startDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
              <button className=" bg-white text-black px-4 py-2 text-sm self-start sm:self-auto border-2 border-black">
                Change
              </button>
            </div>
          ) : (
            <div className="p-4 border-2 border-dashed border-black text-center">
              <p className="text-sm text-muted-foreground">
                No payment method on file
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 shrink-0" />
            Payments processed securely via Razorpay or HDFC SmartGateway. We
            never store your card details.
          </p>
        </div>

        {}
        <div className="border-2 p-4 sm:p-5 bg-white">
          <h3 className="font-display font-bold text-lg text-black mb-4">
            Invoice History
          </h3>
          {invoices.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-black/30">
              <p className="text-xs text-muted-foreground">No invoices found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div
                  key={inv._id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border-2 border-black hover:bg-[#024BAB]/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-muted-foreground">
                      {inv.invoiceNumber}
                    </span>
                    <span className="text-sm font-medium text-black">
                      {new Date(inv.paidAt || inv.createdAt).toLocaleDateString(
                        "en-IN",
                        { day: "numeric", month: "long", year: "numeric" },
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {inv.plan} · {inv.billingCycle}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-black">
                      ₹{inv.amount?.toLocaleString("en-IN")}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 border-2 border-black text-[11px] font-bold",
                        inv.status === "paid"
                          ? "bg-[#00C48C] text-black"
                          : "bg-[#FA731C] text-white",
                      )}
                    >
                      {inv.status === "paid" && <Check className="w-3 h-3" />}
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                    <button
                      onClick={() => handleDownloadInvoice(inv)}
                      disabled={downloading === inv._id}
                      className="text-xs font-bold text-[#024BAB] underline hover:text-[#024BAB]/80 transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <Download className="w-3 h-3" />
                      {downloading === inv._id ? "Opening…" : "Download"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {}
      {gatewayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 border-black bg-white w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-bold text-lg">Choose Payment Gateway</h3>
              <button onClick={() => setGatewayModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Select how you'd like to complete this payment.
              </p>

              {/* Razorpay */}
              <button
                onClick={() => handleGatewaySelect("razorpay")}
                className="w-full border-2 border-black p-4 flex items-center gap-4 hover:bg-[#024BAB]/5 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-black text-sm">Razorpay</p>
                  <p className="text-xs text-muted-foreground">
                    Cards, UPI, Net Banking, Wallets
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
              </button>

              {/* HDFC SmartGateway — disabled until merchant account is configured */}
              <div className="w-full border-2 border-gray-200 p-4 flex items-center gap-4 opacity-50 cursor-not-allowed">
                <div className="w-10 h-10 bg-gray-300 border-2 border-gray-200 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="font-bold text-gray-400 text-sm">
                    HDFC SmartGateway
                  </p>
                  <p className="text-xs text-gray-400">Coming soon</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3" /> All payments are 256-bit
                encrypted
              </p>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
