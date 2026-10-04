import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CheckCircle, Clock, Loader2, Lock, XCircle } from "lucide-react";
import { payLinkAPI } from "@/services/api";
import {
  loadCashfreeScript,
  loadRazorpayScript,
  redirectToGatewayCheckout,
} from "@/lib/paymentGateway";
import { getErrorMessage } from "@/lib/utils";

type Status = "pending" | "paid" | "expired" | "settled";

interface Details {
  status: Status;
  academyName: string;
  studentName: string;
  planName: string;
  amount: number;
  type: "balance" | "renewal";
  paidAt?: string;
}

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

// Public page behind the WhatsApp fee link (/pay/:token). No login: the token
// in the URL is the credential. Same gateway flows as the in-app subscription
// payment (Razorpay/Cashfree modal, PhonePe/Paytm redirect).
export default function PayLinkPage() {
  const { token = "" } = useParams();
  const [searchParams] = useSearchParams();
  const returning = searchParams.get("return") === "1";

  const [details, setDetails] = useState<Details | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound">(
    "loading",
  );
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(returning);

  const load = useCallback(async () => {
    try {
      const res = await payLinkAPI.get(token);
      setDetails(res.data);
      setState("ready");
    } catch {
      setState("notfound");
    }
  }, [token]);

  // Redirect gateways (PhonePe/Paytm) bring the browser back here with
  // ?return=1 — confirm with the gateway before showing anything.
  useEffect(() => {
    (async () => {
      if (returning) {
        try {
          await payLinkAPI.verify(token);
        } catch (e: unknown) {
          setError(getErrorMessage(e) || "Payment could not be confirmed.");
        }
        setConfirming(false);
      }
      await load();
    })();
  }, [token, returning, load]);

  const pay = async () => {
    setPaying(true);
    setError("");
    try {
      const res = await payLinkAPI.startOrder(token);
      const order = res.data;

      if (order.checkoutMode === "redirect") {
        redirectToGatewayCheckout(order);
        return;
      }

      if (order.gateway === "cashfree") {
        if (!(await loadCashfreeScript())) {
          throw new Error("Couldn't load the payment page. Check your connection.");
        }
        const cashfree = await (window as any).Cashfree({
          mode: import.meta.env.PROD ? "production" : "sandbox",
        });
        const result = await cashfree.checkout({
          paymentSessionId: order.paymentSessionId,
          redirectTarget: "_modal",
        });
        if (result.error) throw new Error("Payment cancelled");
        await payLinkAPI.verify(token);
      } else {
        if (!(await loadRazorpayScript())) {
          throw new Error("Couldn't load the payment page. Check your connection.");
        }
        await new Promise<void>((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: order.keyId,
            order_id: order.orderId,
            amount: order.amount * 100,
            currency: order.currency || "INR",
            name: details?.academyName || "NestPlay",
            description: `${order.planName} — ${details?.studentName || ""}`,
            theme: { color: "#024BAB" },
            handler: async (response: any) => {
              try {
                await payLinkAPI.verify(token, {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                });
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
          });
          rzp.open();
        });
      }
      await load();
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      if (msg !== "Payment cancelled") setError(msg || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#F0F6FF] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md bg-white border-2 border-black p-7">
        {children}
      </div>
    </div>
  );

  if (state === "loading" || confirming) {
    return shell(
      <div className="text-center py-6">
        <Loader2 className="w-10 h-10 animate-spin text-[#024BAB] mx-auto mb-3" />
        <p className="font-bold text-black">
          {confirming ? "Confirming your payment…" : "Loading…"}
        </p>
      </div>,
    );
  }

  if (state === "notfound" || !details) {
    return shell(
      <div className="text-center py-4">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="font-bold text-xl text-black mb-1">Link not found</h2>
        <p className="text-sm text-gray-500">
          This payment link is invalid. Please contact your academy.
        </p>
      </div>,
    );
  }

  if (details.status !== "pending") {
    const paid = details.status === "paid" || details.status === "settled";
    return shell(
      <div className="text-center py-4">
        {paid ? (
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        ) : (
          <Clock className="w-12 h-12 text-orange-500 mx-auto mb-3" />
        )}
        <h2 className="font-bold text-xl text-black mb-1">
          {details.status === "paid"
            ? "Payment received"
            : details.status === "settled"
              ? "Nothing due"
              : "Link expired"}
        </h2>
        <p className="text-sm text-gray-500">
          {details.status === "paid"
            ? `Thank you! ${details.studentName}'s ${details.planName} fee is paid. A receipt has been sent on WhatsApp.`
            : details.status === "settled"
              ? `${details.studentName}'s ${details.planName} fee is already paid.`
              : "This link is no longer valid. Please contact your academy for a new one."}
        </p>
        <p className="text-xs text-gray-400 mt-4">{details.academyName}</p>
      </div>,
    );
  }

  return shell(
    <>
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
        {details.academyName}
      </p>
      <h1 className="font-display font-bold text-2xl text-black mt-1">
        Fee payment
      </h1>
      <div className="border-2 border-black mt-5 divide-y-2 divide-black">
        <Row label="Student" value={details.studentName} />
        <Row label="Plan" value={details.planName} />
        <Row
          label={details.type === "renewal" ? "Renewal fee" : "Balance due"}
          value={inr(details.amount)}
          strong
        />
      </div>

      {error && (
        <div className="mt-4 border-2 border-red-400 bg-red-50 text-red-600 text-sm font-medium px-3 py-2">
          {error}
        </div>
      )}

      <button
        onClick={pay}
        disabled={paying}
        className="w-full mt-5 bg-[#024BAB] text-white py-3.5 text-sm font-bold uppercase border-2 border-black flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {paying ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Lock className="w-4 h-4" />
        )}
        {paying ? "Please wait…" : `Pay ${inr(details.amount)}`}
      </button>
      <p className="text-[11px] text-gray-400 text-center mt-3">
        Secure online payment via your academy's payment gateway.
      </p>
    </>,
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs font-bold uppercase text-gray-500">{label}</span>
      <span className={strong ? "font-bold text-lg text-black" : "font-semibold text-black"}>
        {value}
      </span>
    </div>
  );
}
