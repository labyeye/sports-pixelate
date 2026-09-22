import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { subscriptionAPI, bookingAPI } from "@/services/api";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

type Status = "verifying" | "success" | "failed";

// Landing page for PhonePe/Paytm after they send the browser back — those
// gateways are redirect-based (see paymentGatewayService.js), so we can't
// verify from a client-side SDK callback like Razorpay/Cashfree. Instead we
// poll the same verifyPayment endpoint, which re-checks with the gateway's
// own status API before marking anything paid.
export default function PaymentReturnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const type = searchParams.get("type") || "subscription";
    const orderId = searchParams.get("orderId");
    const bookingId = searchParams.get("bookingId");

    if (!orderId) {
      setErrorMsg("No order ID received from the payment gateway.");
      setStatus("failed");
      return;
    }

    const verify =
      type === "booking"
        ? bookingAPI.verifyPayment({ bookingId, orderId })
        : subscriptionAPI.verifyPayment({ orderId });

    verify
      .then(() => setStatus("success"))
      .catch((err: any) => {
        setErrorMsg(err.message || "Payment verification failed.");
        setStatus("failed");
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#F0F6FF] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md bg-white border-2 border-black p-8 text-center">
        {status === "verifying" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-[#024BAB] mx-auto mb-4" />
            <h2 className="font-bold text-xl text-black mb-2">
              Confirming your payment
            </h2>
            <p className="text-sm text-gray-500 font-medium">
              Please wait while we verify your payment with the bank…
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="font-bold text-xl text-black mb-2">
              Payment Successful!
            </h2>
            <p className="text-sm text-gray-500 font-medium mb-6">
              Your payment has been verified.
            </p>
            <button
              onClick={() => navigate("/subscriptions", { replace: true })}
              className="w-full bg-[#024BAB] text-white border-2 border-black font-bold uppercase text-sm px-4 py-3 hover:bg-[#023590] transition-all"
            >
              Continue
            </button>
          </>
        )}

        {status === "failed" && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="font-bold text-xl text-black mb-2">
              Verification Failed
            </h2>
            <p className="text-sm text-gray-500 font-medium mb-6">
              {errorMsg}
            </p>
            <button
              onClick={() => navigate("/subscriptions", { replace: true })}
              className="w-full bg-[#024BAB] text-white border-2 border-black font-bold uppercase text-sm px-4 py-3 hover:bg-[#023590] transition-all mb-3"
            >
              Back to Subscriptions
            </button>
            <p className="text-xs text-gray-400 font-medium">
              If money was deducted, it will show as pending shortly — contact
              support if it doesn't clear.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
