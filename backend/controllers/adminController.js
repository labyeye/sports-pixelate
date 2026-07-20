const asyncHandler = require("express-async-handler");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const OfferCode = require("../models/OfferCode");

const getSaasStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    totalCompanies,
    companiesByStatus,
    newCompaniesThisMonth,
    subscriptionsByStatus,
    subscriptionsByPlan,
    subscriptionsByBillingCycle,
    revenueAgg,
    expiringSoon,
    recentInvoices,
  ] = await Promise.all([
    Company.countDocuments(),

    Company.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    Company.countDocuments({ createdAt: { $gte: startOfMonth } }),

    Subscription.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    Subscription.aggregate([{ $group: { _id: "$plan", count: { $sum: 1 } } }]),

    Subscription.aggregate([
      { $group: { _id: "$billingCycle", count: { $sum: 1 } } },
    ]),

    Invoice.aggregate([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          thisMonthRevenue: {
            $sum: {
              $cond: [{ $gte: ["$paidAt", startOfMonth] }, "$amount", 0],
            },
          },
          totalInvoices: { $sum: 1 },
        },
      },
    ]),

    Subscription.countDocuments({
      status: "active",
      renewalDate: { $gte: now, $lte: next30Days },
    }),

    Invoice.find({ status: "paid" })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("company", "name email"),
  ]);

  // calculate MRR from active subscriptions
  const activeSubs = await Subscription.find({ status: "active" }).select(
    "billingCycle monthlyPrice yearlyPrice",
  );
  const mrr = activeSubs.reduce((sum, sub) => {
    if (sub.billingCycle === "monthly") return sum + (sub.monthlyPrice || 0);
    if (sub.billingCycle === "yearly") return sum + (sub.yearlyPrice || 0) / 12;
    return sum;
  }, 0);

  const statusMap = Object.fromEntries(
    companiesByStatus.map((s) => [s._id, s.count]),
  );
  const subStatusMap = Object.fromEntries(
    subscriptionsByStatus.map((s) => [s._id, s.count]),
  );
  const planMap = Object.fromEntries(
    subscriptionsByPlan.map((s) => [s._id, s.count]),
  );
  const cycleMap = Object.fromEntries(
    subscriptionsByBillingCycle.map((s) => [s._id, s.count]),
  );
  const revenue = revenueAgg[0] || {
    totalRevenue: 0,
    thisMonthRevenue: 0,
    totalInvoices: 0,
  };

  res.json({
    success: true,
    data: {
      companies: {
        total: totalCompanies,
        active: statusMap.active || 0,
        inactive: statusMap.inactive || 0,
        trial: statusMap.trial || 0,
        newThisMonth: newCompaniesThisMonth,
      },
      subscriptions: {
        active: subStatusMap.active || 0,
        inactive: subStatusMap.inactive || 0,
        cancelled: subStatusMap.cancelled || 0,
        pendingRenewal: subStatusMap.pending_renewal || 0,
        expiringSoon,
        byPlan: planMap,
        byBillingCycle: cycleMap,
      },
      revenue: {
        total: revenue.totalRevenue,
        thisMonth: revenue.thisMonthRevenue,
        mrr: Math.round(mrr),
        totalInvoices: revenue.totalInvoices,
      },
      recentInvoices: recentInvoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        plan: inv.plan,
        billingCycle: inv.billingCycle,
        amount: inv.amount,
        paidAt: inv.paidAt,
        company: inv.company
          ? { name: inv.company.name, email: inv.company.email }
          : null,
      })),
    },
  });
});

// ---- Offer codes (called from the company CRM to generate/manage coupons) ----

const DISCOUNT_TYPES = ["bonus_months", "flat_rate", "percent_off"];

const listOfferCodes = asyncHandler(async (req, res) => {
  const offers = await OfferCode.find().sort({ createdAt: -1 });
  res.json({ success: true, data: offers });
});

const createOfferCode = asyncHandler(async (req, res) => {
  const {
    code,
    description,
    discountType = "bonus_months",
    bonusMonths,
    flatRate,
    percentOff,
    maxUses,
    expiresAt,
    createdByEmail,
  } = req.body;

  if (!code || !code.trim()) {
    res.status(400);
    throw new Error("Code is required");
  }
  if (!DISCOUNT_TYPES.includes(discountType)) {
    res.status(400);
    throw new Error(
      `discountType must be one of: ${DISCOUNT_TYPES.join(", ")}`,
    );
  }
  if (discountType === "bonus_months" && !(Number(bonusMonths) > 0)) {
    res.status(400);
    throw new Error(
      "bonusMonths must be a positive number for this discount type",
    );
  }
  if (discountType === "flat_rate" && !(Number(flatRate) > 0)) {
    res.status(400);
    throw new Error(
      "flatRate must be a positive number for this discount type",
    );
  }
  if (
    discountType === "percent_off" &&
    !(Number(percentOff) > 0 && Number(percentOff) <= 100)
  ) {
    res.status(400);
    throw new Error(
      "percentOff must be between 1 and 100 for this discount type",
    );
  }

  const normalizedCode = code.toUpperCase().trim();
  if (await OfferCode.findOne({ code: normalizedCode })) {
    res.status(400);
    throw new Error("An offer code with this code already exists");
  }

  const offer = await OfferCode.create({
    code: normalizedCode,
    description: description || "",
    discountType,
    bonusMonths: discountType === "bonus_months" ? Number(bonusMonths) : 0,
    flatRate: discountType === "flat_rate" ? Number(flatRate) : null,
    percentOff: discountType === "percent_off" ? Number(percentOff) : null,
    maxUses: maxUses ? Number(maxUses) : 200,
    expiresAt: expiresAt || null,
    createdByEmail: createdByEmail || "",
  });

  res.status(201).json({ success: true, data: offer });
});

const updateOfferCode = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive, maxUses, expiresAt, description } = req.body;

  const update = {};
  if (typeof isActive === "boolean") update.isActive = isActive;
  if (maxUses != null) update.maxUses = Number(maxUses);
  if (expiresAt !== undefined) update.expiresAt = expiresAt || null;
  if (description !== undefined) update.description = description;

  const offer = await OfferCode.findByIdAndUpdate(id, update, { new: true });
  if (!offer) {
    res.status(404);
    throw new Error("Offer code not found");
  }
  res.json({ success: true, data: offer });
});

module.exports = {
  getSaasStats,
  listOfferCodes,
  createOfferCode,
  updateOfferCode,
};
