const asyncHandler = require("express-async-handler");
const Facility = require("../models/Facility");
const { validateBody } = require("../middleware/validate");

const createSchema = {
  name: { required: true, type: "string", minLength: 1, maxLength: 100 },
};

const getFacilities = asyncHandler(async (req, res) => {
  const facilities = await Facility.find({
    company: req.user.company,
    active: true,
  }).sort({
    name: 1,
  });
  res.json({ success: true, data: facilities });
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
