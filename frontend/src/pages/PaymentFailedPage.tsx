import { useSearchParams, useNavigate } from "react-router-dom";
import { Zap, AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

const REASONS: Record<string, string> = {
  Aborted: "Payment was cancelled.",
  Invalid: "Payment details were invalid.",
  Failure: "Payment was declined by your bank.",
  Timeout: "The payment session timed out.",
};

export default function PaymentFailedPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawReason = searchParams.get("reason") || "";
  const reason =
    REASONS[rawReason] || rawReason || "Payment could not be completed.";

  return (
    <div className="min-h-screen bg-[#F0F6FF] flex flex-col">
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
          <div className="bg-white border-2 border-black">
            {}
            <div className="bg-red-500 border-b-2 border-black p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-white mx-auto mb-3" />
              <h1 className="font-bold text-2xl text-white">Payment Failed</h1>
              <p className="text-red-100 font-medium text-sm mt-1">
                Your subscription has not been activated
              </p>
            </div>

            <div className="p-6 border-b-2 border-black">
              <p className="text-sm font-medium text-gray-600 text-center">
                {reason}
              </p>
            </div>

            {}
            <div className="p-5 bg-[#FFF8F0] border-b-2 border-black">
              <p className="text-xs font-bold uppercase text-gray-500 mb-3">
                Common causes
              </p>
              <ul className="space-y-1 text-xs font-medium text-gray-600">
                <li>• Insufficient balance or card limit exceeded</li>
                <li>• Transaction declined by your bank</li>
                <li>• OTP expired or entered incorrectly</li>
                <li>• Session timed out (try again)</li>
                <li>• International transactions not enabled</li>
              </ul>
            </div>

            <div className="p-6 space-y-3">
              <button
                onClick={() => navigate("/onboarding")}
                className="w-full bg-[#024BAB] text-white border-2 border-black font-bold uppercase text-sm px-4 py-3 flex items-center justify-center gap-2 hover:bg-[#023590] transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={() => navigate("/onboarding")}
                className="w-full bg-white text-black border-2 border-black font-bold uppercase text-sm px-4 py-3 flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Plans
              </button>
              <p className="text-xs text-gray-400 text-center font-medium">
                Money deducted but not activated?{" "}
                <a
                  href="mailto:support@pixelatenest.com"
                  className="text-[#024BAB] underline font-bold"
                >
                  Contact support
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
