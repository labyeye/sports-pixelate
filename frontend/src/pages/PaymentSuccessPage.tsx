import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { billingAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckCircle,
  Loader2,
  Zap,
  ArrowRight,
  Mail,
  MessageCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

type Status = "verifying" | "success" | "failed";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateUser, user } = useAuth();

  const [status, setStatus] = useState<Status>("verifying");
  const [details, setDetails] = useState<{
    plan: string;
    billingCycle: string;
    amount: number;
    renewalDate: string;
    invoiceNumber: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const orderId = searchParams.get("order_id") || searchParams.get("orderId");
    const trackingId =
      searchParams.get("tracking_id") || searchParams.get("trackingId");
    const hdfcStatus =
      searchParams.get("order_status") || searchParams.get("status");

    if (hdfcStatus && !["Success", "success", "SUCCESS"].includes(hdfcStatus)) {
      navigate("/payment/failed?reason=" + encodeURIComponent(hdfcStatus), {
        replace: true,
      });
      return;
    }

    if (!orderId) {
      setErrorMsg("No order ID received from payment gateway.");
      setStatus("failed");
      return;
    }

    billingAPI
      .verifyPayment({ orderId, trackingId })
      .then((res: any) => {
        setDetails(res.data);
        setStatus("success");

        updateUser({
          company: { ...user?.company!, status: "active" },
          subscription: { status: "active" },
        });
      })
      .catch((err: any) => {
        setErrorMsg(err.message || "Payment verification failed.");
        setStatus("failed");
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#F0F6FF] flex flex-col">
      {}
      <header className="bg-white border-b-2 border-black">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-3">
          <div className="w-9 h-9 bg-[#024BAB] border-2 border-black flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-xl text-black">
            NestSports
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {}
          {status === "verifying" && (
            <div className="bg-white border-2 border-black p-10 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-[#024BAB] mx-auto mb-4" />
              <h2 className="font-bold text-xl text-black mb-2">
                Confirming your payment
              </h2>
              <p className="text-sm text-gray-500 font-medium">
                Please wait while we verify your payment with HDFC SmartGateway…
              </p>
            </div>
          )}

          {}
          {status === "success" && details && (
            <div className="bg-white border-2 border-black">
              {}
              <div className="bg-green-500 border-b-2 border-black p-6 text-center">
                <CheckCircle className="w-12 h-12 text-white mx-auto mb-3" />
                <h1 className="font-bold text-2xl text-white">
                  Payment Successful!
                </h1>
                <p className="text-green-100 font-medium text-sm mt-1">
                  Your NestSports subscription is now active
                </p>
              </div>

              {}
              <div className="p-6 space-y-3 border-b-2 border-black">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-gray-500">Invoice</span>
                  <span className="font-bold text-black font-mono">
                    {details.invoiceNumber}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-gray-500">Plan</span>
                  <span className="font-bold text-black uppercase">
                    {details.plan}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-gray-500">Billing</span>
                  <span className="font-bold text-black capitalize">
                    {details.billingCycle}
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t-2 border-black pt-3">
                  <span className="font-bold text-sm uppercase">
                    Amount Paid
                  </span>
                  <span className="font-bold text-xl text-[#024BAB]">
                    ₹{details.amount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-gray-500">Next Renewal</span>
                  <span className="font-bold text-black">
                    {formatDate(details.renewalDate)}
                  </span>
                </div>
              </div>

              {}
              <div className="p-4 bg-[#F0F6FF] border-b-2 border-black">
                <p className="text-xs font-bold uppercase text-gray-500 mb-2">
                  Confirmations sent to
                </p>
                <div className="flex gap-4 text-xs font-bold text-gray-600">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-[#024BAB]" /> Email
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5 text-green-600" />{" "}
                    WhatsApp
                  </span>
                </div>
              </div>

              {}
              <div className="p-6">
                <button
                  onClick={() => navigate("/welcome", { replace: true })}
                  className="w-full bg-[#024BAB] text-white border-2 border-black font-bold uppercase text-sm px-4 py-3 flex items-center justify-center gap-2 hover:bg-[#023590] transition-all"
                >
                  Continue to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-xs text-gray-400 text-center mt-3 font-medium">
                  Your team is ready to onboard. Let's get started.
                </p>
              </div>
            </div>
          )}

          {/* Failed verification */}
          {status === "failed" && (
            <div className="bg-white border-2 border-black p-8 text-center">
              <div className="w-12 h-12 bg-red-100 border-2 border-red-500 flex items-center justify-center mx-auto mb-4">
                <span className="text-red-500 font-bold text-xl">✕</span>
              </div>
              <h2 className="font-bold text-xl text-black mb-2">
                Verification Failed
              </h2>
              <p className="text-sm text-gray-500 font-medium mb-6">
                {errorMsg}
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => navigate("/onboarding")}
                  className="w-full bg-[#024BAB] text-white border-2 border-black font-bold uppercase text-sm px-4 py-3 hover:bg-[#023590] transition-all"
                >
                  Try Again
                </button>
                <p className="text-xs text-gray-400 font-medium">
                  If money was deducted, contact{" "}
                  <a
                    href="mailto:support@pixelatenest.com"
                    className="text-[#024BAB] underline"
                  >
                    support@pixelatenest.com
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
