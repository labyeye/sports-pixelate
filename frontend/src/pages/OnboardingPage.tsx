import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { billingAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/Toaster";
import CompanyDetailsForm from "@/components/CompanyDetailsForm";
import {
  Check,
  Zap,
  Loader2,
  ChevronRight,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type Step = "company" | "students" | "payment";

interface CompanyFormData {
  name: string;
  email: string;
  phone: string;
  industry: string;
  website: string;
  gstNumber: string;
  panNumber: string;
}

type Tier = "standard" | "whatsapp";

const RATE_PER_STUDENT: Record<Tier, number> = {
  standard: 150,
  whatsapp: 300,
};

const STEPS: { id: Step; label: string }[] = [
  { id: "company", label: "SportsClub" },
  { id: "students", label: "Students" },
  { id: "payment", label: "Payment" },
];

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-9 h-9 border-2 border-black flex items-center justify-center font-bold text-sm transition-all",
                  done && "bg-[#024BAB] text-white",
                  active && "bg-[#FA731C] text-white",
                  !done && !active && "bg-white text-gray-400",
                )}
              >
                {done ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase mt-1 tracking-wide",
                  active
                    ? "text-[#FA731C]"
                    : done
                      ? "text-[#024BAB]"
                      : "text-gray-400",
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-16 h-0.5 mt-[-14px] mx-1",
                  idx < currentIdx ? "bg-[#024BAB]" : "bg-gray-200",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(
    user?.company ? "students" : "company",
  );
  const [studentCount, setStudentCount] = useState<number | "">("");
  const [tier, setTier] = useState<Tier>("standard");
  const [paying, setPaying] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const [companyForm, setCompanyForm] = useState<CompanyFormData | null>(null);

  useEffect(() => {
    if (user?.company && user?.subscription?.status === "active") {
      navigate("/", { replace: true });
    }
  }, [user?.company, user?.subscription?.status, navigate]);

  const count = Number(studentCount) || 0;
  const rate = RATE_PER_STUDENT[tier];
  const yearlyPrice = count * rate;
  const monthlyEquiv = Math.round(yearlyPrice / 12);

  const handleCreateCompany = async (formData: CompanyFormData) => {
    // No API call here — the company is only persisted in the database
    // once payment succeeds (see handlePay). We just hold the details
    // in state and move the wizard forward.
    setCompanyError("");
    setCompanyForm(formData);
    setStep("students");
  };

  const handleStudentContinue = () => {
    if (!count || count < 1) {
      toast({
        title: "Enter student count",
        description: "How many students will you manage?",
        variant: "destructive",
      });
      return;
    }
    setStep("payment");
  };

  const loadRazorpayScript = (): Promise<boolean> =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handlePay = async () => {
    if (!user?.company && !companyForm) {
      toast({
        title: "SportsClub details missing",
        description: "Please go back and fill in your SportsClub details.",
        variant: "destructive",
      });
      return;
    }
    setPaying(true);
    try {
      const res = await billingAPI.createOrder(
        count,
        "yearly",
        "razorpay",
        user?.company ? undefined : companyForm!,
        tier,
      );
      if (!res.success) throw new Error("Failed to create order");
      const order = res.data;

      const loaded = await loadRazorpayScript();
      if (!loaded)
        throw new Error(
          "Failed to load payment checkout. Check your connection.",
        );

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount * 100,
          currency: order.currency || "INR",
          name: "NestSports",
          description: `NestSports — ${count} students`,
          theme: { color: "#024BAB" },
          handler: async (response: any) => {
            try {
              const verifyRes = await billingAPI.verifyRazorpay({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              toast({
                title: "Payment Successful!",
                description: "Subscription activated. Welcome to NestSports!",
                variant: "success",
              });
              const createdCompany = verifyRes.data?.company;
              updateUser({
                company: createdCompany
                  ? {
                      id: createdCompany._id,
                      name: createdCompany.name,
                      email: createdCompany.email,
                      status: createdCompany.status,
                    }
                  : { ...user?.company!, status: "active" },
                subscription: { status: "active" },
              });
              setTimeout(() => navigate("/welcome", { replace: true }), 1500);
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
    } catch (err: any) {
      const msg = err.message || "Please try again.";
      if (msg.includes("User already has a SportsClub")) {
        toast({
          title: "SportsClub already exists",
          description: "Redirecting...",
          variant: "destructive",
        });
        setTimeout(() => navigate("/", { replace: true }), 1800);
      } else if (err.message !== "Payment cancelled") {
        toast({
          title: "Could not initiate payment",
          description: msg,
          variant: "destructive",
        });
      }
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F6FF]">
      {}
      <header className="bg-white border-b-2 border-black sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#024BAB] border-2 border-black flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-black">
              NestSports
            </span>
          </div>
          <button
            onClick={logout}
            className="text-sm font-bold text-black hover:text-[#024BAB] transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <StepIndicator current={step} />

        {}
        {step === "company" && (
          <div>
            <div className="text-center mb-8">
              <h1 className="font-display font-bold text-3xl text-black mb-2">
                Set up your SportsClub
              </h1>
              <p className="text-gray-500 font-medium text-sm">
                Your legal and contact details
              </p>
            </div>
            <div className="bg-white border-2 border-black p-8 max-w-2xl mx-auto">
              <CompanyDetailsForm
                loading={false}
                error={companyError}
                onError={setCompanyError}
                onSubmit={handleCreateCompany}
              />
            </div>
          </div>
        )}

        {}
        {step === "students" && (
          <div>
            <div className="text-center mb-8">
              <h1 className="font-display font-bold text-3xl text-black mb-2">
                How many students?
              </h1>
              <p className="text-gray-500 font-medium text-sm">
                Priced per student, per year — pick the plan that fits your
                club
              </p>
            </div>

            <div className="bg-white border-2 border-black p-8 max-w-sm mx-auto">
              <label className="block text-xs font-bold uppercase tracking-wider text-black mb-3">
                Plan
              </label>
              <div className="grid grid-cols-2 gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => setTier("standard")}
                  className={cn(
                    "text-left p-3 border-2 transition-all",
                    tier === "standard"
                      ? "bg-[#024BAB] text-white border-black"
                      : "bg-white text-black border-black hover:bg-gray-50",
                  )}
                >
                  <p className="font-bold text-sm">₹{RATE_PER_STUDENT.standard}/student/yr</p>
                  <p className={cn("text-[11px] font-medium mt-0.5", tier === "standard" ? "text-white/80" : "text-gray-500")}>
                    No WhatsApp
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setTier("whatsapp")}
                  className={cn(
                    "text-left p-3 border-2 transition-all",
                    tier === "whatsapp"
                      ? "bg-[#024BAB] text-white border-black"
                      : "bg-white text-black border-black hover:bg-gray-50",
                  )}
                >
                  <p className="font-bold text-sm">₹{RATE_PER_STUDENT.whatsapp}/student/yr</p>
                  <p className={cn("text-[11px] font-medium mt-0.5", tier === "whatsapp" ? "text-white/80" : "text-gray-500")}>
                    + WhatsApp notifications
                  </p>
                </button>
              </div>

              <label className="block text-xs font-bold uppercase tracking-wider text-black mb-3">
                Number of students
              </label>
              <input
                type="number"
                min={1}
                value={studentCount}
                onChange={(e) =>
                  setStudentCount(
                    e.target.value === ""
                      ? ""
                      : Math.max(1, parseInt(e.target.value) || 1),
                  )
                }
                placeholder="e.g. 40"
                autoFocus
                className="w-full border-2 border-black px-4 py-3 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#024BAB] mb-2"
              />
              <p className="text-xs text-gray-400 font-medium text-center mb-2">
                Your current enrolled students, across all sports and batches
              </p>
              {count > 0 && (
                <p className="text-sm font-bold text-[#024BAB] text-center mb-6">
                  ₹{yearlyPrice.toLocaleString("en-IN")}/year (₹
                  {monthlyEquiv.toLocaleString("en-IN")}/mo equiv.)
                </p>
              )}

              {/* Quick picks */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                {[20, 50, 100, 200].map((n) => (
                  <button
                    key={n}
                    onClick={() => setStudentCount(n)}
                    className={cn(
                      "py-2 text-sm font-bold border-2 transition-all",
                      Number(studentCount) === n
                        ? "bg-[#024BAB] text-white border-black"
                        : "bg-white text-black border-black hover:bg-gray-50",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <button
                onClick={handleStudentContinue}
                className="w-full bg-[#024BAB] text-white border-2 border-black font-bold uppercase text-sm px-4 py-3 flex items-center justify-center gap-2 hover:bg-[#023590] transition-all"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Payment ─────────────────────────────────────────── */}
        {step === "payment" && (
          <div>
            <div className="text-center mb-8">
              <h1 className="font-display font-bold text-3xl text-black mb-2">
                Confirm & Pay
              </h1>
              <p className="text-gray-500 font-medium text-sm">
                A secure Razorpay checkout will open to complete your payment
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-4">
              {/* Order summary */}
              <div className="bg-white border-2 border-black">
                <div className="p-5 border-b-2 border-black bg-[#F0F6FF]">
                  <p className="font-bold text-xs uppercase text-gray-500">
                    Order Summary
                  </p>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-gray-600">Plan</span>
                    <span className="font-bold text-black">
                      ₹{rate}/student/year {tier === "whatsapp" ? "(+ WhatsApp)" : ""}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-gray-600">Students</span>
                    <span className="font-bold text-black">{studentCount}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-gray-600">
                      Monthly equiv.
                    </span>
                    <span className="font-bold text-gray-500">
                      ₹{monthlyEquiv.toLocaleString("en-IN")}/mo
                    </span>
                  </div>
                  <div className="border-t-2 border-black pt-3 flex justify-between items-center">
                    <span className="font-bold text-sm uppercase">
                      Total / year
                    </span>
                    <span className="font-bold text-xl text-[#024BAB]">
                      ₹{yearlyPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* What happens next */}
              <div className="bg-white border-2 border-black p-5">
                <p className="font-bold text-xs uppercase text-gray-500 mb-3">
                  What happens next
                </p>
                <ol className="space-y-2 text-xs font-medium text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-[#024BAB] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    A Razorpay checkout window will open (secure page)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-[#024BAB] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    Complete payment using net banking, UPI, card, or wallet
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-[#024BAB] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    Complete payment and your subscription activates instantly
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-[#024BAB] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      4
                    </span>
                    Confirmation sent to your email and WhatsApp
                  </li>
                </ol>
              </div>

              <button
                onClick={handlePay}
                disabled={paying}
                className="w-full bg-[#024BAB] text-white border-2 border-black font-bold uppercase text-sm px-4 py-4 flex items-center justify-center gap-2 hover:bg-[#023590] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Opening checkout...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-5 h-5" />
                    Pay ₹{yearlyPrice.toLocaleString("en-IN")} via Razorpay
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Secured by Razorpay · PCI-DSS compliant
              </div>

              <button
                onClick={() => setStep("students")}
                className="w-full text-center text-xs text-gray-400 hover:text-black font-bold transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </main>
      <Toaster />
    </div>
  );
}
