const asyncHandler = require("express-async-handler");
const Sport = require("../models/Sport");
const Student = require("../models/Student");
const Employee = require("../models/Employee");
const { validateBody } = require("../middleware/validate");

const createSchema = {
  name: { required: true, type: "string", minLength: 1, maxLength: 60 },
};

const updateSchema = {
  name: { type: "string", minLength: 1, maxLength: 60 },
  active: { type: "boolean" },
};

// Sports list with live student/coach headcounts, so the UI can show e.g.
// "Tennis — 42 students, 3 coaches" without a separate round trip.
const getSports = asyncHandler(async (req, res) => {
  const companyId = req.user.company;

  const [sports, studentCounts, coachCounts] = await Promise.all([
    Sport.find({ company: companyId }).sort({ name: 1 }),
    Student.aggregate([
      { $match: { company: companyId, status: { $ne: "inactive" } } },
      { $group: { _id: "$sport", count: { $sum: 1 } } },
    ]),
    Employee.aggregate([
      {
        $match: {
          company: companyId,
          role: "coach",
          status: { $ne: "terminated" },
        },
      },
      { $group: { _id: "$sport", count: { $sum: 1 } } },
    ]),
  ]);

  const studentCountBySport = Object.fromEntries(
    studentCounts.map((c) => [c._id, c.count]),
  );
  const coachCountBySport = Object.fromEntries(
    coachCounts.map((c) => [c._id, c.count]),
  );

  const data = sports.map((sport) => ({
    ...sport.toObject(),
    studentCount: studentCountBySport[sport.name] || 0,
    coachCount: coachCountBySport[sport.name] || 0,
  }));

  res.json({ success: true, data });
});

const createSport = [
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const name = req.body.name.trim();
    const existing = await Sport.findOne({ company: req.user.company, name });
    if (existing) {
      res.status(201).json({ success: true, data: existing });
      return;
    }
    const sport = await Sport.create({ company: req.user.company, name });
    res.status(201).json({ success: true, data: sport });
  }),
];

const updateSport = [
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const update = { ...req.body };
    if (typeof update.name === "string") update.name = update.name.trim();
    const sport = await Sport.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      update,
      { new: true, runValidators: true },
    );
    if (!sport) {
      res.status(404);
      throw new Error("Sport not found");
    }
    res.json({ success: true, data: sport });
  }),
];

const deleteSport = asyncHandler(async (req, res) => {
  const sport = await Sport.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    { active: false },
    { new: true },
  );
  if (!sport) {
    res.status(404);
    throw new Error("Sport not found");
  }
  res.json({ success: true, message: "Sport deactivated" });
});

module.exports = { getSports, createSport, updateSport, deleteSport };
