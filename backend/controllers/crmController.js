const Invoice = require("../models/Invoice");
const OfferCode = require("../models/OfferCode");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");

// Same static-key guard as /internal/stats (statsRoutes.js), reusing
// CRM_API_SECRET so the CRM only needs one secret per product.
const crmAuth = (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.CRM_API_SECRET) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return false;
  }
  return true;
};

const STATUS_MAP = {
  paid: "paid",
  unpaid: "pending",
  overdue: "failed",
};

// GET /api/crm/invoices
exports.getCrmInvoices = async (req, res) => {
  if (!crmAuth(req, res)) return;

  const query = {};
  if (req.query.status) {
    const mapped = STATUS_MAP[req.query.status];
    if (!mapped) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Use paid, unpaid, or overdue.",
      });
    }
    query.status = mapped;
  }

  const invoices = await Invoice.find(query)
    .populate("company", "name email phone status")
    .populate("subscription", "plan billingCycle status maxStudents")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, invoices });
};

// GET /api/crm/offers — list all offer codes with stats
exports.getCrmOffers = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const offers = await OfferCode.find()
      .select("-usages")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: offers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/crm/offers/:id — single offer with full usage list
exports.getCrmOfferById = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const offer = await OfferCode.findById(req.params.id).lean();
    if (!offer)
      return res
        .status(404)
        .json({ success: false, message: "Offer not found" });
    res.json({ success: true, data: offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/crm/offers — create a new offer code
exports.createCrmOffer = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const {
      code,
      description,
      discountType,
      bonusMonths,
      flatRate,
      percentOff,
      applicableTier,
      maxUses,
      expiresAt,
      createdByEmail,
    } = req.body;

    if (!code)
      return res
        .status(400)
        .json({ success: false, message: "code is required" });

    const type = discountType || "bonus_months";
    if (type === "bonus_months" && (!bonusMonths || bonusMonths < 1)) {
      return res
        .status(400)
        .json({ success: false, message: "bonusMonths must be >= 1" });
    }
    if (type === "flat_rate" && (!flatRate || flatRate < 1)) {
      return res
        .status(400)
        .json({ success: false, message: "flatRate must be >= 1" });
    }
    if (type === "percent_off" && (!percentOff || percentOff < 1 || percentOff > 100)) {
      return res
        .status(400)
        .json({ success: false, message: "percentOff must be between 1 and 100" });
    }

    const offer = await OfferCode.create({
      code: code.toUpperCase().trim(),
      description: description || "",
      discountType: type,
      bonusMonths: type === "bonus_months" ? bonusMonths : 0,
      flatRate: type === "flat_rate" ? flatRate : null,
      percentOff: type === "percent_off" ? percentOff : null,
      applicableTier: applicableTier || null,
      maxUses: maxUses || 200,
      expiresAt: expiresAt || null,
      createdByEmail: createdByEmail || "",
    });

    res.status(201).json({ success: true, data: offer });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Offer code already exists" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/crm/offers/:id — update offer (activate/deactivate, change limits)
exports.updateCrmOffer = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const allowed = [
      "description",
      "bonusMonths",
      "flatRate",
      "percentOff",
      "applicableTier",
      "maxUses",
      "isActive",
      "expiresAt",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const offer = await OfferCode.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    }).select("-usages");
    if (!offer)
      return res
        .status(404)
        .json({ success: false, message: "Offer not found" });
    res.json({ success: true, data: offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/crm/offers/:id — hard delete
exports.deleteCrmOffer = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const offer = await OfferCode.findByIdAndDelete(req.params.id);
    if (!offer)
      return res
        .status(404)
        .json({ success: false, message: "Offer not found" });
    res.json({ success: true, message: "Offer code deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/crm/companies/:companyId/subscription — activate/extend/deactivate a
// company's subscription from the external CRM dashboard on payment/expiry events.
exports.updateCrmSubscription = async (req, res) => {
  if (!crmAuth(req, res)) return;
  try {
    const { companyId } = req.params;
    const { status, paymentStatus, renewalDate } = req.body;

    const allowedStatus = [
      "active",
      "inactive",
      "cancelled",
      "pending_renewal",
    ];
    const allowedPaymentStatus = ["pending", "completed", "failed"];
    if (status !== undefined && !allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${allowedStatus.join(", ")}`,
      });
    }
    if (
      paymentStatus !== undefined &&
      !allowedPaymentStatus.includes(paymentStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: `Invalid paymentStatus. Must be one of: ${allowedPaymentStatus.join(", ")}`,
      });
    }

    const company = await Company.findById(companyId).select("subscription");
    if (!company) {
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });
    }
    if (!company.subscription) {
      return res.status(404).json({
        success: false,
        message: "Company has no subscription to update",
      });
    }

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus;
    if (renewalDate !== undefined) updates.renewalDate = new Date(renewalDate);

    const subscription = await Subscription.findByIdAndUpdate(
      company.subscription,
      updates,
      { new: true },
    );

    res.json({ success: true, subscription });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
