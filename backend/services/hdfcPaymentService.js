const https = require("https");
const crypto = require("crypto");

const BASE_URL =
  process.env.HDFC_ENV === "production"
    ? "smartgateway.hdfcbank.com"
    : "smartgatewayuat.hdfcbank.com";

function getMerchantCredentials() {
  const merchantId = process.env.HDFC_MERCHANT_ID;
  const accessKey = process.env.HDFC_ACCESS_KEY;

  if (!merchantId || !accessKey) {
    throw new Error(
      "HDFC SmartGateway credentials not configured. " +
        "Set HDFC_MERCHANT_ID and HDFC_ACCESS_KEY in .env",
    );
  }
  return { merchantId, accessKey };
}

function basicAuth(merchantId, accessKey) {
  return (
    "Basic " + Buffer.from(`${merchantId}:${accessKey}`).toString("base64")
  );
}

function httpsPost(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(
                new Error(
                  parsed.message || `HDFC API error ${res.statusCode}: ${data}`,
                ),
              );
            }
          } catch {
            reject(new Error(`HDFC response parse error: ${data}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function createOrder({ orderId, amount, currency = "INR", customer }) {
  const { merchantId, accessKey } = getMerchantCredentials();
  const frontendUrl =
    process.env.FRONTEND_URL || "https://sports.pixelatenest.com";

  const response = await httpsPost(
    BASE_URL,
    "/payment/gateway/v1/order/create",
    {
      merchant_id: merchantId,
      order_id: orderId,
      amount: amount.toFixed(2),
      currency,
      redirect_url: `${frontendUrl}/payment/success`,
      cancel_url: `${frontendUrl}/payment/failed`,
      billing_name: customer.name,
      billing_email: customer.email,
      billing_tel: customer.phone || "",
      billing_address: customer.address || "India",
      billing_city: customer.city || "India",
      billing_state: customer.state || "India",
      billing_zip: customer.pincode || "000000",
      billing_country: "India",
      language: "EN",

      merchant_param1: customer.userId,
      merchant_param2: customer.companyId,
    },
    {
      Authorization: basicAuth(merchantId, accessKey),
    },
  );

  const paymentUrl =
    response.payment_url || response.paymentPageUrl || response.payment_link;

  if (!paymentUrl) {
    throw new Error(
      "HDFC did not return a payment URL. " +
        "Check HDFC_MERCHANT_ID, HDFC_ACCESS_KEY, and request payload.",
    );
  }

  return {
    orderId,
    paymentUrl,
    amount,
    currency,
  };
}

async function verifyPayment({ orderId, trackingId }) {
  const { merchantId, accessKey } = getMerchantCredentials();

  const response = await httpsPost(
    BASE_URL,
    "/payment/gateway/v1/order/status",
    {
      merchant_id: merchantId,
      order_id: orderId,

      ...(trackingId ? { tracking_id: trackingId } : {}),
    },
    {
      Authorization: basicAuth(merchantId, accessKey),
    },
  );

  const status = (response.order_status || response.status || "").toUpperCase();

  const isSuccess = status === "SUCCESS" || status === "CAPTURED";

  return {
    isSuccess,
    status: response.order_status || response.status,
    trackingId: response.tracking_id || trackingId,
    bankRefNo: response.bank_ref_no || "",
    amount: parseFloat(response.amount || "0"),
    paymentMode: response.payment_mode || "",
    raw: response,
  };
}

function generateOrderId(prefix = "NHRM") {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}${ts}${rand}`.slice(0, 20);
}

module.exports = { createOrder, verifyPayment, generateOrderId };
