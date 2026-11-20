import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { billingAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/Toaster";
import CompanyDetailsForm from "@/components/CompanyDetailsForm";
import {
  Check,
  Loader2,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { cn, getErrorMessage } from "@/lib/utils";
import nestplayLogo from "../../assets/logo.png";
import { payWithCashfree } from "@/lib/cashfree";

type Step = "company" | "students" | "payment";

interface CompanyFormData {
  name: string;
  email: string;
  phone: string;
  website: string;
  gstNumber: string;
  panNumber: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

import PlanPicker from "@/components/billing/PlanPicker";
import { GST_RATE, getPlan, inr, priceFor, type PlanId } from "@/lib/plans";

const STEPS: { id: Step; label: string }[] = [
  { id: "company", label: "SportsClub" },
  { id: "students", label: "Plan" },
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
                  "w-9 h-9 border-2 border-black flex items-center justify-center font-bold text-sm transition-all rounded-full",
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
  const [planId, setPlanId] = useState<PlanId | "">("");
  const [paying, setPaying] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const [companyForm, setCompanyForm] = useState<CompanyFormData | null>(null);

  useEffect(() => {
    if (user?.company && user?.subscription?.status === "active") {
      navigate("/", { replace: true });
    }
  }, [user?.company, user?.subscription?.status, navigate]);

  const price = planId ? priceFor(planId) : null;

  const handleCreateCompany = async (formData: CompanyFormData) => {
    // No API call here — the company is only persisted in the database
    // once payment succeeds (see handlePay). We just hold the details
    // in state and move the wizard forward.
    setCompanyError("");
    setCompanyForm(formData);
    setStep("students");
  };

  const handleStudentContinue = () => {
    if (!planId) {
      toast({
        title: "Choose a plan",
        description: "Pick the plan that fits your number of students.",
        variant: "destructive",
      });
      return;
    }
    setStep("payment");
  };

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
        planId as PlanId,
        user?.company ? undefined : companyForm!,
      );
      if (!res.success) throw new Error("Failed to create order");
      const order = res.data;

      if ((await payWithCashfree(order)) !== "done")
        throw new Error("Payment cancelled");

      const verifyRes = await billingAPI.verifyCashfree({
        orderId: order.orderId,
      });
      toast({
        title: "Payment Successful!",
        description: "Subscription activated. Welcome to NestAcademy!",
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
          : { ...user!.company!, status: "active" },
        subscription: { status: "active" },
      });
      setTimeout(() => navigate("/welcome", { replace: true }), 1500);
    } catch (err: unknown) {
      const msg = getErrorMessage(err) || "Please try again.";
      if (msg.includes("User already has a SportsClub")) {
        toast({
          title: "SportsClub already exists",
          description: "Redirecting...",
          variant: "destructive",
        });
        setTimeout(() => navigate("/", { replace: true }), 1800);
      } else if (getErrorMessage(err) !== "Payment cancelled") {
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
            <img src={nestplayLogo} alt="NestAcademy" className="w-full h-14" />
          </div>
          <button
            onClick={logout}
            className="text-sm font-bold text-black hover:text-[#024BAB] transition-colors"
          >
            Logout <ArrowRight className="w-4 h-4 inline-block" />
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
                Choose your plan
              </h1>
              <p className="text-gray-500 font-medium text-sm">
                Yearly plans by number of students. Staff are free.
              </p>
            </div>

            <PlanPicker value={planId} onChange={setPlanId} />

            <div className="max-w-sm mx-auto mt-6">
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
                A secure Cashfree checkout will open to complete your payment
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
                      {getPlan(planId)?.name} · yearly
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-gray-600">Students</span>
                    <span className="font-bold text-black">
                      {getPlan(planId)?.maxStudents
                        ? `Up to ${getPlan(planId)?.maxStudents}`
                        : "Unlimited"}
                    </span>
                  </div>
                  <div className="border-t-2 border-black pt-3 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-gray-600">Subtotal</span>
                      <span className="font-bold text-black">
                        {inr(price?.subtotal ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-gray-600">
                        GST ({GST_RATE}%)
                      </span>
                      <span className="font-bold text-black">
                        {inr(price?.gst ?? 0)}
                      </span>
                    </div>
                  </div>
                  <div className="border-t-2 border-black pt-3 flex justify-between items-center">
                    <span className="font-bold text-sm uppercase">
                      Total / year
                    </span>
                    <span className="font-bold text-xl text-[#024BAB]">
                      {inr(price?.total ?? 0)}
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
                    A Cashfree checkout window will open (secure page)
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
                    Pay {inr(price?.total ?? 0)} via Cashfree
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Secured by Cashfree · PCI-DSS compliant
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
