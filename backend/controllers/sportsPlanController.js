const asyncHandler = require("express-async-handler");
const SportsPlan = require("../models/SportsPlan");
const {
  escapeRegex,
  safePagination,
  safeSort,
  validateBody,
} = require("../middleware/validate");

const createSchema = {
  name: { required: true, type: "string", minLength: 1, maxLength: 100 },
  sport: { required: true, type: "string", minLength: 1, maxLength: 60 },
  monthlyPrice: { required: true, type: "number", min: 0 },
  yearlyPrice: { required: true, type: "number", min: 0 },
};

const PLAN_SORT_FIELDS = ["name", "sport", "monthlyPrice", "sessionsPerWeek"];

// Everyone in the academy (owner/staff/parent) can browse the plan catalog —
// parents need this to choose a plan when subscribing their child.
const getPlans = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query, 100, 200);
  const { sport, search } = req.query;

  const filter = { company: req.user.company, active: true };
  if (sport) filter.sport = sport;
  if (search) {
    filter.name = { $regex: escapeRegex(search.slice(0, 100)), $options: "i" };
  }

  const sort = safeSort(req.query, PLAN_SORT_FIELDS, { monthlyPrice: 1 });
  const total = await SportsPlan.countDocuments(filter);
  const plans = await SportsPlan.find(filter).sort(sort).skip(skip).limit(limit);
  res.json({
    success: true,
    data: plans,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const createPlan = [
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const {
      name,
      sport,
      sessionsPerWeek,
      monthlyPrice,
      yearlyPrice,
      description,
    } = req.body;
    const plan = await SportsPlan.create({
      company: req.user.company,
      name,
      sport,
      sessionsPerWeek,
      monthlyPrice,
      yearlyPrice,
      description,
    });
    res.status(201).json({ success: true, data: plan });
  }),
];

const updatePlan = asyncHandler(async (req, res) => {
  const plan = await SportsPlan.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    req.body,
    { new: true, runValidators: true },
  );
  if (!plan) {
    res.status(404);
    throw new Error("Plan not found");
  }
  res.json({ success: true, data: plan });
});

const deletePlan = asyncHandler(async (req, res) => {
  const plan = await SportsPlan.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    { active: false },
    { new: true },
  );
  if (!plan) {
    res.status(404);
    throw new Error("Plan not found");
  }
  res.json({ success: true, message: "Plan deactivated" });
});

// Bulk create coaching plans from a parsed spreadsheet (Excel import).
const bulkImportPlans = asyncHandler(async (req, res) => {
  const { plans: rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400);
    throw new Error("plans array is required");
  }
  if (rows.length > 200) {
    res.status(400);
    throw new Error("Maximum 200 plans per import");
  }

  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const name = (row.name || "").trim();
      const sport = (row.sport || "").trim();
      const monthlyPrice = Number(row.monthlyPrice);
      const yearlyPrice = Number(row.yearlyPrice);

      if (
        !name ||
        !sport ||
        !Number.isFinite(monthlyPrice) ||
        !Number.isFinite(yearlyPrice)
      ) {
        results.push({
          row: i + 1,
          status: "error",
          message:
            "Missing required field (name, sport, monthlyPrice, yearlyPrice)",
        });
        continue;
      }

      const plan = await SportsPlan.create({
        company: req.user.company,
        name,
        sport,
        monthlyPrice,
        yearlyPrice,
        sessionsPerWeek: Number(row.sessionsPerWeek) || undefined,
        description: row.description || undefined,
      });

      results.push({ row: i + 1, status: "success", name: plan.name });
    } catch (err) {
      results.push({ row: i + 1, status: "error", message: err.message });
    }
  }

  const imported = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;

  res.json({ success: true, imported, failed, results });
});

module.exports = {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  bulkImportPlans,
};
