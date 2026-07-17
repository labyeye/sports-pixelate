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

module.exports = { getPlans, createPlan, updatePlan, deletePlan };
