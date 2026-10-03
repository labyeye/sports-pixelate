const express = require("express");
const router = express.Router();

const Employee = require("../models/Employee");
const Payroll = require("../models/Payroll");

const crypto = require("crypto");
const logger = require("../utils/logger");

// No fallback token: if META_WA_VERIFY_TOKEN isn't configured the webhook
// can't be (re)subscribed, which is safer than a guessable default.
const VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN;

// Meta signs every delivery with HMAC-SHA256(app secret, raw body). Without
// this check anyone could POST fake "payslip received" events.
function validSignature(req) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    // Fail closed in production; allow local development without a secret.
    return process.env.NODE_ENV !== "production";
  }
  const header = req.headers["x-hub-signature-256"];
  if (!header || !req.rawBody) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
  const a = Buffer.from(String(header));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

//
// ─────────────────────────────────────────────────────────────
// Webhook Verification
// ─────────────────────────────────────────────────────────────
//
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (VERIFY_TOKEN && mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

//
// ─────────────────────────────────────────────────────────────
// Incoming Webhook
// ─────────────────────────────────────────────────────────────
//
router.post("/", async (req, res) => {
  if (!validSignature(req)) return res.sendStatus(401);
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const value = entry?.changes?.[0]?.value;

    if (!value) {
      logger.info("[WA] No value object");
      return;
    }

    //
    // Status updates (sent, delivered, read)
    //
    if (value.statuses) {
      logger.info("[WA] Status Event");
    }

    //
    // Incoming messages
    //
    const messages = value.messages;

    if (!messages || !messages.length) {
      logger.info("[WA] No incoming messages");
      return;
    }

    for (const msg of messages) {
      const fromPhone = msg.from;

      let payload = null;

      //
      // OLD FORMAT
      //
      if (msg.type === "button") {
        payload = msg.button?.payload;
      }

      //
      // NEW FORMAT
      //
      if (
        msg.type === "interactive" &&
        msg.interactive?.type === "button_reply"
      ) {
        payload = msg.interactive.button_reply.id;
      }

      //
      // Text message
      //
      if (msg.type === "text") {
      }

      if (!payload) {
        logger.info("[WA] No button payload found.");
        continue;
      }

      logger.info(
        `[WA] Button Clicked -> Phone=${fromPhone} Payload=${payload}`,
      );

      if (
        payload !== "PAYSLIP_RECEIVED" &&
        payload !== "PAYSLIP_NOT_RECEIVED"
      ) {
        logger.info("[WA] Unknown payload");
        continue;
      }

      const slipStatus =
        payload === "PAYSLIP_RECEIVED" ? "received" : "not_received";

      const phone10 = fromPhone.replace(/^91/, "").slice(-10);

      const employee = await Employee.findOne({
        phone: {
          $in: [
            fromPhone,
            phone10,
            `+${fromPhone}`,
            `91${phone10}`,
            `+91${phone10}`,
          ],
        },
      }).select("_id company phone");

      if (!employee) {
        logger.info(`[WA] Employee not found for ${fromPhone}`);
        continue;
      }

      logger.info(`[WA] Employee Found ${employee._id}`);

      // Allow updating from "not_received" → "received" (employee clicked wrong button).
      // Only block if already confirmed as "received".
      const payroll = await Payroll.findOne({
        employee: employee._id,
        company: employee.company,
        status: "paid",
        slipReceived: { $in: [null, "not_received"] },
      }).sort({
        year: -1,
        month: -1,
      });

      if (!payroll) {
        logger.info(
          "[WA] No updatable payroll found (already confirmed received)",
        );
        continue;
      }

      payroll.slipReceived = slipStatus;
      payroll.slipReceivedAt = new Date();

      await payroll.save();

      logger.info(`✅ Payroll Updated (${payroll._id}) -> ${slipStatus}`);
    }
  } catch (err) {
    console.error("[WA-Webhook ERROR]");
    console.error(err);
  }
});

module.exports = router;
