const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const Student = require("../models/Student");
const User = require("../models/User");
const {
  escapeRegex,
  safePagination,
  validateBody,
} = require("../middleware/validate");

const createSchema = {
  firstName: { required: true, type: "string", minLength: 1, maxLength: 80 },
  lastName: { required: true, type: "string", minLength: 1, maxLength: 80 },
  sport: { required: true, type: "string", minLength: 1, maxLength: 60 },
};

const updateSchema = {
  firstName: { type: "string", minLength: 1, maxLength: 80 },
  lastName: { type: "string", minLength: 1, maxLength: 80 },
  sport: { type: "string", minLength: 1, maxLength: 60 },
};

const GUARDIAN_RELATIONS = ["father", "mother", "guardian", "other"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Whitelists and validates the guardians array from the request body so
// arbitrary fields (e.g. photo, _id) can't be injected outside this flow.
function sanitizeGuardians(input) {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) throw new Error("guardians must be an array");
  return input.map((g, i) => {
    if (!g || typeof g !== "object")
      throw new Error(`guardians[${i}] must be an object`);
    const { relation, name, phone, email, photo } = g;
    if (!GUARDIAN_RELATIONS.includes(relation))
      throw new Error(
        `guardians[${i}].relation must be one of: ${GUARDIAN_RELATIONS.join(", ")}`,
      );
    if (typeof name !== "string" || !name.trim() || name.length > 80)
      throw new Error(`guardians[${i}].name is required`);
    if (email && !EMAIL_RE.test(email))
      throw new Error(`guardians[${i}].email must be a valid email`);
    return {
      relation,
      name: name.trim(),
      phone: phone ? String(phone).trim() : undefined,
      email: email ? String(email).trim() : undefined,
      // Round-tripped from a prior GET/photo-upload response, not user-uploaded here.
      photo: typeof photo === "string" ? photo : undefined,
    };
  });
}

function normalizePhone(phone) {
  return String(phone).replace(/\s/g, "").replace(/^\+91/, "").slice(-10);
}

// A guardian's phone number is their login: find (scoped to this academy) or
// create the matching parent User so they can reach the parent dashboard via
// phone-OTP login, same as the flow in authController.sendOtp/verifyOtp.
async function ensureParentAccounts(guardians, companyId) {
  if (!Array.isArray(guardians)) return [];
  const parentIds = [];
  for (const g of guardians) {
    if (!g.phone) continue;
    const normalized = normalizePhone(g.phone);
    if (normalized.length !== 10) continue;
    const phoneVariants = [normalized, `+91${normalized}`, `91${normalized}`];

    let user = await User.findOne({
      phone: { $in: phoneVariants },
      company: companyId,
    });
    if (!user) {
      user = await User.create({
        name: g.name,
        email: `parent.${normalized}.${companyId}@parents.nestsports.local`,
        password: crypto.randomBytes(8).toString("hex") + "A1",
        role: "parent",
        phone: normalized,
        company: companyId,
      });
    }
    parentIds.push(user._id);
  }
  return parentIds;
}

// Owner/staff: full roster for the academy. Parent: only their linked children.
const getStudents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { search, sport, batch, status, coach } = req.query;

  const filter = { company: req.user.company };
  if (req.user.role === "parent") filter._id = { $in: req.user.children || [] };
  if (status) filter.status = status;
  if (sport) filter.sport = sport;
  if (batch) filter.batch = batch;
  if (coach) filter.coach = coach;
  if (search) {
    const s = escapeRegex(search.slice(0, 100));
    filter.$or = [
      { firstName: { $regex: s, $options: "i" } },
      { lastName: { $regex: s, $options: "i" } },
      { studentId: { $regex: s, $options: "i" } },
    ];
  }

  const total = await Student.countDocuments(filter);
  const students = await Student.find(filter)
    .populate("coach", "firstName lastName")
    .populate("parents", "name email phone")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({ success: true, data: students, total, page, pages: Math.ceil(total / limit) });
});

const getStudent = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, company: req.user.company };
  if (req.user.role === "parent") filter._id = { $in: req.user.children || [] };

  const student = await Student.findOne(filter)
    .populate("coach", "firstName lastName")
    .populate("parents", "name email phone");
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }
  res.json({ success: true, data: student });
});

const createStudent = [
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      sport,
      batch,
      coach,
      parents,
      guardians,
      emergencyContact,
      medicalNotes,
      enrollmentDate,
    } = req.body;

    let sanitizedGuardians;
    try {
      sanitizedGuardians = sanitizeGuardians(guardians);
    } catch (err) {
      res.status(400);
      throw err;
    }

    const count = await Student.countDocuments({ company: req.user.company });
    const studentId = `STU${String(count + 1).padStart(4, "0")}`;

    const autoParentIds = await ensureParentAccounts(
      sanitizedGuardians,
      req.user.company,
    );
    const parentIds = Array.from(
      new Set(
        [
          ...(Array.isArray(parents) ? parents : []),
          ...autoParentIds,
        ].map(String),
      ),
    );

    const student = await Student.create({
      company: req.user.company,
      studentId,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      sport,
      batch,
      coach: coach || undefined,
      parents: parentIds,
      guardians: sanitizedGuardians || [],
      emergencyContact,
      medicalNotes,
      enrollmentDate: enrollmentDate || Date.now(),
    });

    if (autoParentIds.length) {
      await User.updateMany(
        { _id: { $in: autoParentIds } },
        { $addToSet: { children: student._id } },
      );
    }

    res.status(201).json({ success: true, data: student });
  }),
];

const updateStudent = [
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const update = { ...req.body };
    let autoParentIds = [];
    if (Object.prototype.hasOwnProperty.call(update, "guardians")) {
      try {
        update.guardians = sanitizeGuardians(update.guardians);
      } catch (err) {
        res.status(400);
        throw err;
      }
      autoParentIds = await ensureParentAccounts(
        update.guardians,
        req.user.company,
      );
    }

    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      update,
      { new: true, runValidators: true },
    );
    if (!student) {
      res.status(404);
      throw new Error("Student not found");
    }

    if (autoParentIds.length) {
      await Student.updateOne(
        { _id: student._id },
        { $addToSet: { parents: { $each: autoParentIds } } },
      );
      await User.updateMany(
        { _id: { $in: autoParentIds } },
        { $addToSet: { children: student._id } },
      );
      student.parents = Array.from(
        new Set(
          [...(student.parents || []), ...autoParentIds].map(String),
        ),
      );
    }

    res.json({ success: true, data: student });
  }),
];

// Student profile photo — file is saved by the uploadAvatar middleware.
const uploadStudentAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
  const student = await Student.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    { avatar: avatarUrl },
    { new: true },
  );
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }
  res.json({ success: true, avatar: avatarUrl });
});

// Individual guardian's photo — file is saved by the uploadGuardianPhoto middleware.
const uploadGuardianPhotoHandler = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const photoUrl = `${baseUrl}/uploads/guardian-photos/${req.file.filename}`;

  const student = await Student.findOneAndUpdate(
    {
      _id: req.params.id,
      company: req.user.company,
      "guardians._id": req.params.guardianId,
    },
    { $set: { "guardians.$.photo": photoUrl } },
    { new: true },
  );
  if (!student) {
    res.status(404);
    throw new Error("Student or guardian not found");
  }
  res.json({ success: true, photo: photoUrl });
});

const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    { status: "inactive", exitDate: new Date() },
    { new: true },
  );
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }
  res.json({ success: true, message: "Student deactivated" });
});

module.exports = {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  uploadStudentAvatar,
  uploadGuardianPhotoHandler,
};
