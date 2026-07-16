const express = require("express");
const router = express.Router();

const Employee = require("../models/Employee");
const Payroll = require("../models/Payroll");

const VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN || "nesthr_verify_token";

//
// ─────────────────────────────────────────────────────────────
// Webhook Verification
// ─────────────────────────────────────────────────────────────
//
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("[WA-Webhook] Verification Request");
  console.log({
    mode,
    token,
    expected: VERIFY_TOKEN,
  });

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[WA-Webhook] ✅ Verification successful");
    return res.status(200).send(challenge);
  }

  console.warn("[WA-Webhook] ❌ Verification failed");
  return res.sendStatus(403);
});

//
// ─────────────────────────────────────────────────────────────
// Incoming Webhook
// ─────────────────────────────────────────────────────────────
//
router.post("/", async (req, res) => {
  console.log("\n🔥🔥🔥 WHATSAPP WEBHOOK HIT 🔥🔥🔥");
  console.log("Time:", new Date().toISOString());
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Body:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);

  console.log("\n================ WEBHOOK RECEIVED ================");
  console.log(JSON.stringify(req.body, null, 2));
  console.log("=================================================\n");

  try {
    const entry = req.body?.entry?.[0];
    const value = entry?.changes?.[0]?.value;

    if (!value) {
      console.log("[WA] No value object");
      return;
    }

    //
    // Status updates (sent, delivered, read)
    //
    if (value.statuses) {
      console.log("[WA] Status Event");
      console.log(JSON.stringify(value.statuses, null, 2));
    }

    //
    // Incoming messages
    //
    const messages = value.messages;

    if (!messages || !messages.length) {
      console.log("[WA] No incoming messages");
      return;
    }

    for (const msg of messages) {
      console.log("\n----------- Incoming Message -----------");
      console.log(JSON.stringify(msg, null, 2));
      console.log("----------------------------------------");

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
        console.log("[WA] Text:", msg.text?.body);
      }

      if (!payload) {
        console.log("[WA] No button payload found.");
        continue;
      }

      console.log(
        `[WA] Button Clicked -> Phone=${fromPhone} Payload=${payload}`,
      );

      if (
        payload !== "PAYSLIP_RECEIVED" &&
        payload !== "PAYSLIP_NOT_RECEIVED"
      ) {
        console.log("[WA] Unknown payload");
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
        console.log(`[WA] Employee not found for ${fromPhone}`);
        continue;
      }

      console.log(`[WA] Employee Found ${employee._id}`);

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
        console.log(
          "[WA] No updatable payroll found (already confirmed received)",
        );
        continue;
      }

      payroll.slipReceived = slipStatus;
      payroll.slipReceivedAt = new Date();

      await payroll.save();

      console.log(`✅ Payroll Updated (${payroll._id}) -> ${slipStatus}`);
    }
  } catch (err) {
    console.error("[WA-Webhook ERROR]");
    console.error(err);
  }
});

module.exports = router;
