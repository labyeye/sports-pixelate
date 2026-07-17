const asyncHandler = require("express-async-handler");
const Facility = require("../models/Facility");
const {
  escapeRegex,
  safePagination,
  safeSort,
  validateBody,
} = require("../middleware/validate");

const createSchema = {
  name: { required: true, type: "string", minLength: 1, maxLength: 100 },
};

const FACILITY_SORT_FIELDS = ["name", "type", "capacity", "hourlyFee", "createdAt"];

const getFacilities = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { type, sport, search } = req.query;

  const filter = { company: req.user.company, active: true };
  if (type) filter.type = type;
  if (sport) filter.sport = sport;
  if (search) {
    filter.name = { $regex: escapeRegex(search.slice(0, 100)), $options: "i" };
  }

  const sort = safeSort(req.query, FACILITY_SORT_FIELDS, { name: 1 });
  const total = await Facility.countDocuments(filter);
  const facilities = await Facility.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit);
  res.json({
    success: true,
    data: facilities,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const createFacility = [
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const { name, type, sport, capacity, hourlyFee } = req.body;
    const facility = await Facility.create({
      company: req.user.company,
      name,
      type,
      sport,
      capacity,
      hourlyFee,
    });
    res.status(201).json({ success: true, data: facility });
  }),
];

const updateFacility = asyncHandler(async (req, res) => {
  const facility = await Facility.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    req.body,
    { new: true, runValidators: true },
  );
  if (!facility) {
    res.status(404);
    throw new Error("Facility not found");
  }
  res.json({ success: true, data: facility });
});

const deleteFacility = asyncHandler(async (req, res) => {
  const facility = await Facility.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    { active: false },
    { new: true },
  );
  if (!facility) {
    res.status(404);
    throw new Error("Facility not found");
  }
  res.json({ success: true, message: "Facility deactivated" });
});

module.exports = {
  getFacilities,
  createFacility,
  updateFacility,
  deleteFacility,
};
