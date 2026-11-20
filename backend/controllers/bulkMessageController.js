const asyncHandler = require("express-async-handler");
const BulkMessage = require("../models/BulkMessage");
const Student = require("../models/Student");
const wa = require("../services/whatsappService");
const { notifyParentsOfStudent } = require("../services/inAppNotify");
const logger = require("../utils/logger");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const summary = (m) => {
  const c = { pending: 0, sent: 0, failed: 0 };
  m.recipients.forEach((r) => c[r.status]++);
  return {
    _id: m._id,
    text: m.text,
    doc: m.doc?.filename || null,
    audience: m.audience,
    running: m.running,
    createdAt: m.createdAt,
    total: m.recipients.length,
    ...c,
  };
};

// Sends every pending/failed recipient one by one. Runs after the HTTP response; a per-recipient
// failure is recorded on that recipient and never stops the rest.
// ponytail: in-process loop, a server restart mid-run leaves rows "pending" (Resend picks them up). Move to a queue if volume grows.
async function run(id, companyId) {
  const m = await BulkMessage.findOneAndUpdate(
    { _id: id, company: companyId, running: { $ne: true } },
    { running: true },
    { new: true },
  );
  if (!m) return;
  try {
    for (const r of m.recipients) {
      if (r.status === "sent") continue;
      r.attempts += 1;
      try {
        r.wamid = await wa.sendFreeform(
          r.phone,
          { text: m.text, mediaId: m.doc?.mediaId, filename: m.doc?.filename },
          companyId,
        );
        r.status = "sent";
        r.error = undefined;
        r.sentAt = new Date();
        if (r.student)
          notifyParentsOfStudent(r.student, companyId, {
            type: "message",
            title: "Message from academy",
            message: String(
              m.text || "You have a new document from the academy.",
            ).slice(0, 300),
            student: r.student,
          });
      } catch (e) {
        r.status = "failed";
        r.error = String(e.message || e).slice(0, 300);
        if (e.code === "NO_CREDITS") {
          // nothing else can go out either; leave the rest pending so Resend retries them
          await m.save();
          break;
        }
      }
      await m.save();
      await sleep(150);
    }
  } catch (e) {
    logger.error(`[bulk] ${id}: ${e.message}`);
  } finally {
    await BulkMessage.updateOne({ _id: id }, { running: false });
  }
}

// POST /bulk-messages  (multipart: text, studentIds? JSON array, doc? file)
exports.create = asyncHandler(async (req, res) => {
  const text = String(req.body.text || "").trim();
  if (!text && !req.file) {
    res.status(400);
    throw new Error("Write a message or attach a document");
  }
  if (text.length > 4000) {
    res.status(400);
    throw new Error("Message is too long (max 4000 characters)");
  }
  if (!(await wa.getCompanySetting(null, req.user.company))) {
    res.status(400);
    throw new Error(
      "WhatsApp is not enabled for this academy (Settings → WhatsApp)",
    );
  }

  let ids = [];
  try {
    ids = JSON.parse(req.body.studentIds || "[]");
  } catch {
    /* treated as all */
  }
  const filter = { company: req.user.company, status: "active" };
  if (Array.isArray(ids) && ids.length) filter._id = { $in: ids };
  const students = await Student.find(filter)
    .select("firstName lastName guardians")
    .lean();

  const seen = new Set();
  const recipients = [];
  for (const s of students) {
    for (const g of s.guardians || []) {
      const digits = String(g.phone || "")
        .replace(/\D/g, "")
        .slice(-10);
      if (digits.length !== 10 || seen.has(digits)) continue; // same parent of two kids gets one copy
      seen.add(digits);
      recipients.push({
        student: s._id,
        studentName: `${s.firstName} ${s.lastName || ""}`.trim(),
        name: g.name,
        phone: digits,
      });
    }
  }
  if (!recipients.length) {
    res.status(400);
    throw new Error(
      "No guardian phone numbers found for the selected students",
    );
  }

  let doc;
  if (req.file) {
    const mediaId = await wa.uploadMediaToMeta(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
    );
    if (!mediaId) {
      res.status(502);
      throw new Error("Could not upload the document to WhatsApp");
    }
    doc = {
      mediaId,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    };
  }

  const m = await BulkMessage.create({
    company: req.user.company,
    createdBy: req.user._id,
    text,
    doc,
    audience: Array.isArray(ids) && ids.length ? "custom" : "all",
    recipients,
  });
  run(m._id, req.user.company);
  res.status(201).json({ success: true, data: summary(m) });
});

exports.list = asyncHandler(async (req, res) => {
  const rows = await BulkMessage.find({ company: req.user.company })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ success: true, data: rows.map(summary) });
});

exports.get = asyncHandler(async (req, res) => {
  const m = await BulkMessage.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!m) {
    res.status(404);
    throw new Error("Message not found");
  }
  res.json({
    success: true,
    data: { ...summary(m), recipients: m.recipients },
  });
});

// POST /bulk-messages/:id/resend — only failed/pending recipients are tried again
exports.resend = asyncHandler(async (req, res) => {
  const m = await BulkMessage.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!m) {
    res.status(404);
    throw new Error("Message not found");
  }
  if (m.running) {
    res.status(409);
    throw new Error("Still sending, try again in a minute");
  }
  if (!m.recipients.some((r) => r.status !== "sent")) {
    res.status(400);
    throw new Error("Everyone already received this message");
  }
  run(m._id, req.user.company);
  res.json({ success: true, data: summary(m) });
});
