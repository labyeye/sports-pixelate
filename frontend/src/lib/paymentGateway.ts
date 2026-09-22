// Shared checkout helpers for the gateways a club can connect in Settings
// (Razorpay, Cashfree modal SDKs; PhonePe/Paytm redirect-based).
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function loadCashfreeScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Cashfree) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// PhonePe/Paytm send the browser back to /payment-return after the user
// pays, which polls verifyPayment. Paytm's redirect is a form POST (not a
// plain URL), so it needs an auto-submitting form instead of a location
// change.
export function redirectToGatewayCheckout(order: {
  redirectUrl?: string;
  redirectFields?: Record<string, string>;
}) {
  if (!order.redirectUrl) return;
  if (!order.redirectFields) {
    window.location.href = order.redirectUrl;
    return;
  }
  const form = document.createElement("form");
  form.method = "POST";
  form.action = order.redirectUrl;
  for (const [key, value] of Object.entries(order.redirectFields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
