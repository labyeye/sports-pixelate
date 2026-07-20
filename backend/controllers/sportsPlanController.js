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
  yearlyPrice: { required: false, type: "number", min: 0 },
};

const PLAN_SORT_FIELDS = ["name", "sport", "monthlyPrice", "sessionsPerWeek"];

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const SCHEDULE_TYPES = ["unlimited", "sessions_per_week", "custom_days"];

// Reconciles scheduleType/scheduleDays/sessionsPerWeek so a plan can't end up
// with e.g. scheduleType "custom_days" but stale sessionsPerWeek from before —
// sessionsPerWeek is always derived, never trusted from the client for that mode.
function normalizeSchedule(body) {
  const scheduleType = SCHEDULE_TYPES.includes(body.scheduleType)
    ? body.scheduleType
    : "sessions_per_week";
  let scheduleDays = Array.isArray(body.scheduleDays)
    ? body.scheduleDays.filter((d) => WEEKDAYS.includes(d))
    : [];

  let sessionsPerWeek;
  if (scheduleType === "unlimited") {
    sessionsPerWeek = 0;
    scheduleDays = [];
  } else if (scheduleType === "custom_days") {
    sessionsPerWeek = scheduleDays.length;
  } else {
    sessionsPerWeek = Number(body.sessionsPerWeek) || 0;
    scheduleDays = [];
  }

  return { scheduleType, scheduleDays, sessionsPerWeek };
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Validates the plan's session clock time ("HH:mm" 24-hour strings). Returns
// undefined for a field left blank so it doesn't overwrite an existing value
// with an empty string on update.
function normalizeTiming(body) {
  const timing = {};
  for (const key of ["startTime", "endTime"]) {
    if (body[key] === undefined) continue;
    if (body[key] === "" || body[key] === null) {
      timing[key] = undefined;
      continue;
    }
    if (typeof body[key] !== "string" || !TIME_RE.test(body[key])) {
      throw new Error(`${key} must be in HH:mm 24-hour format`);
    }
    timing[key] = body[key];
  }
  return timing;
}

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
  const plans = await SportsPlan.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit);
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
    const { name, sport, monthlyPrice, yearlyPrice, description } = req.body;
    const { scheduleType, scheduleDays, sessionsPerWeek } = normalizeSchedule(
      req.body,
    );
    let startTime, endTime;
    try {
      ({ startTime, endTime } = normalizeTiming(req.body));
    } catch (err) {
      res.status(400);
      throw err;
    }
    const plan = await SportsPlan.create({
      company: req.user.company,
      name,
      sport,
      scheduleType,
      scheduleDays,
      sessionsPerWeek,
      startTime,
      endTime,
      monthlyPrice,
      // Defaults to 12x monthly when left blank, still overridable for a
      // discounted annual rate.
      yearlyPrice: yearlyPrice === undefined ? monthlyPrice * 12 : yearlyPrice,
      description,
    });
    res.status(201).json({ success: true, data: plan });
  }),
];

const updatePlan = asyncHandler(async (req, res) => {
  const update = { ...req.body };
  // Same 12x-monthly default as createPlan when yearlyPrice is left blank.
  if (update.monthlyPrice !== undefined && update.yearlyPrice === undefined) {
    update.yearlyPrice = update.monthlyPrice * 12;
  }
  if (update.scheduleType !== undefined || update.scheduleDays !== undefined) {
    Object.assign(update, normalizeSchedule(update));
  }
  if (update.startTime !== undefined || update.endTime !== undefined) {
    try {
      Object.assign(update, normalizeTiming(update));
    } catch (err) {
      res.status(400);
      throw err;
    }
  }
  const plan = await SportsPlan.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    update,
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

      const rawScheduleDays =
        typeof row.scheduleDays === "string"
          ? row.scheduleDays.split(",").map((d) => d.trim().toLowerCase())
          : [];
      const scheduleType = rawScheduleDays.length
        ? "custom_days"
        : row.sessionsPerWeek
          ? "sessions_per_week"
          : "unlimited";
      const {
        scheduleType: normType,
        scheduleDays,
        sessionsPerWeek,
      } = normalizeSchedule({
        scheduleType,
        scheduleDays: rawScheduleDays,
        sessionsPerWeek: row.sessionsPerWeek,
      });

      const plan = await SportsPlan.create({
        company: req.user.company,
        name,
        sport,
        monthlyPrice,
        yearlyPrice,
        scheduleType: normType,
        scheduleDays,
        sessionsPerWeek,
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
