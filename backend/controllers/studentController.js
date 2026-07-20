const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const Student = require("../models/Student");
const User = require("../models/User");
const Employee = require("../models/Employee");
const StudentSubscription = require("../models/StudentSubscription");
const {
  escapeRegex,
  safePagination,
  safeSort,
  validateBody,
} = require("../middleware/validate");

const STUDENT_SORT_FIELDS = [
  "firstName",
  "lastName",
  "sport",
  "batch",
  "enrollmentDate",
  "createdAt",
];
const { enrollFace } = require("../services/faceService");

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
  const sanitized = input.map((g, i) => {
    if (!g || typeof g !== "object")
      throw new Error(`guardians[${i}] must be an object`);
    const { relation, name, phone, email, photo, receivesWhatsapp, password } =
      g;
    if (!GUARDIAN_RELATIONS.includes(relation))
      throw new Error(
        `guardians[${i}].relation must be one of: ${GUARDIAN_RELATIONS.join(", ")}`,
      );
    if (typeof name !== "string" || !name.trim() || name.length > 80)
      throw new Error(`guardians[${i}].name is required`);
    if (email && !EMAIL_RE.test(email))
      throw new Error(`guardians[${i}].email must be a valid email`);
    if (password !== undefined && password !== "") {
      if (typeof password !== "string" || password.length < 6)
        throw new Error(
          `guardians[${i}].password must be at least 6 characters`,
        );
      if (password.length > 128)
        throw new Error(`guardians[${i}].password is too long`);
    }
    return {
      relation,
      name: name.trim(),
      phone: phone ? String(phone).trim() : undefined,
      email: email ? String(email).trim() : undefined,
      // Round-tripped from a prior GET/photo-upload response, not user-uploaded here.
      photo: typeof photo === "string" ? photo : undefined,
      receivesWhatsapp: !!receivesWhatsapp,
      // Not stored on the guardian subdocument — only used by
      // ensureParentAccounts to set login credentials, then discarded.
      password: password || undefined,
    };
  });
  // Only one guardian per student should get WhatsApp notifications —
  // enforce it here rather than silently picking one, so the UI's choice
  // is never overridden without the caller knowing.
  const whatsappCount = sanitized.filter((g) => g.receivesWhatsapp).length;
  if (whatsappCount > 1)
    throw new Error(
      "Only one guardian can be selected to receive WhatsApp notifications",
    );
  return sanitized;
}

// Guardian `password` only exists to seed the linked parent account
// (ensureParentAccounts) and must never land on the Student document itself.
function stripGuardianPasswords(guardians) {
  if (!Array.isArray(guardians)) return guardians;
  return guardians.map(({ password, ...g }) => g);
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
      // Prefer the email/password entered on the student form (lets the
      // admin set real login credentials up front); fall back to a
      // placeholder that only supports phone-OTP login.
      let email = `parent.${normalized}.${companyId}@parents.nestsports.local`;
      if (g.email) {
        const exists = await User.findOne({ email: g.email });
        if (!exists) email = g.email;
      }
      user = await User.create({
        name: g.name,
        email,
        password: g.password || crypto.randomBytes(8).toString("hex") + "A1",
        role: "parent",
        phone: normalized,
        company: companyId,
      });
    }
    parentIds.push(user._id);
  }
  return parentIds;
}

// Attaches each student's currently active (or awaiting-first-payment) coaching
// plan schedule, so attendance screens can tell which weekdays/timing a
// student is actually expected on without a separate round trip.
async function attachActivePlans(students) {
  const list = Array.isArray(students) ? students : [students];
  const studentIds = list.map((s) => s._id);
  const activeSubs = await StudentSubscription.find({
    student: { $in: studentIds },
    status: { $in: ["active", "pending_renewal"] },
  }).populate(
    "plan",
    "name scheduleType scheduleDays sessionsPerWeek startTime endTime",
  );

  const planByStudent = {};
  for (const sub of activeSubs) {
    // Prefer an "active" (already paid) subscription over a merely
    // "pending_renewal" one if a student somehow has both.
    const key = String(sub.student);
    if (!planByStudent[key] || sub.status === "active") {
      planByStudent[key] = sub.plan;
    }
  }

  const data = list.map((s) => {
    const obj = s.toObject ? s.toObject() : s;
    obj.activePlan = planByStudent[String(s._id)] || null;
    return obj;
  });
  return Array.isArray(students) ? data : data[0];
}

// A coach only sees students assigned to them; other logged-in employees
// (role !== "coach") keep seeing the full roster.
async function coachStudentFilter(user) {
  if (user.role !== "employee") return null;
  const employee = await Employee.findOne({ user: user._id }).select(
    "_id role",
  );
  if (!employee || employee.role !== "coach") return null;
  return employee._id;
}

// Owner/staff: full roster for the academy. Coach: only their assigned
// students. Parent: only their linked children.
const getStudents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { search, sport, batch, status, coach } = req.query;

  const filter = { company: req.user.company };
  if (req.user.role === "parent") filter._id = { $in: req.user.children || [] };
  const coachId = await coachStudentFilter(req.user);
  if (coachId) filter.coach = coachId;
  if (sport) filter.sport = sport;
  if (batch) filter.batch = batch;
  if (coach && !coachId) filter.coach = coach;
  if (search) {
    const s = escapeRegex(search.slice(0, 100));
    filter.$or = [
      { firstName: { $regex: s, $options: "i" } },
      { lastName: { $regex: s, $options: "i" } },
      { studentId: { $regex: s, $options: "i" } },
    ];
  }

  // Status counts computed over the filter WITHOUT status applied, so
  // "All / Active (n) / Inactive (n) / On Hold (n)" pills stay meaningful
  // regardless of which status is currently selected.
  const countRows = await Student.aggregate([
    { $match: filter },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts = countRows.reduce((acc, r) => {
    acc[r._id] = r.count;
    return acc;
  }, {});

  if (status) filter.status = status;

  const sort = safeSort(req.query, STUDENT_SORT_FIELDS, { createdAt: -1 });
  const total = await Student.countDocuments(filter);
  const students = await Student.find(filter)
    .populate("coach", "firstName lastName")
    .populate("parents", "name email phone")
    .sort(sort)
    .skip(skip)
    .limit(limit);

  const data = await attachActivePlans(students);

  res.json({
    success: true,
    data,
    total,
    page,
    pages: Math.ceil(total / limit),
    counts,
  });
});

const getStudent = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, company: req.user.company };
  if (req.user.role === "parent") filter._id = { $in: req.user.children || [] };
  const coachId = await coachStudentFilter(req.user);
  if (coachId) filter.coach = coachId;

  const student = await Student.findOne(filter)
    .populate("coach", "firstName lastName")
    .populate("parents", "name email phone");
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }
  const data = await attachActivePlans(student);
  res.json({ success: true, data });
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
      bloodGroup,
      emergencyContactPerson,
      address,
      sportsProfile,
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
        [...(Array.isArray(parents) ? parents : []), ...autoParentIds].map(
          String,
        ),
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
      guardians: stripGuardianPasswords(sanitizedGuardians) || [],
      emergencyContact,
      medicalNotes,
      enrollmentDate: enrollmentDate || Date.now(),
      bloodGroup,
      emergencyContactPerson,
      address,
      sportsProfile,
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
      update.guardians = stripGuardianPasswords(update.guardians);
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
        new Set([...(student.parents || []), ...autoParentIds].map(String)),
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

  // Mirror onto the guardian's linked parent login so their app avatar
  // (matched by phone, same as ensureParentAccounts) shows this photo too.
  const guardian = student.guardians.id(req.params.guardianId);
  if (guardian?.phone) {
    const normalized = normalizePhone(guardian.phone);
    if (normalized.length === 10) {
      await User.updateOne(
        {
          phone: { $in: [normalized, `+91${normalized}`, `91${normalized}`] },
          company: req.user.company,
          role: "parent",
        },
        { $set: { avatar: photoUrl } },
      );
    }
  }

  res.json({ success: true, photo: photoUrl });
});

// Enrolls (or re-enrolls) a student's face embedding for coach-verified
// attendance check-ins, using the internal face-recognition microservice.
// The uploaded photo itself is never persisted — only the resulting embedding.
const enrollStudentFace = asyncHandler(async (req, res) => {
  const student = await Student.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }
  if (!req.file) {
    res.status(400);
    throw new Error("Photo is required");
  }

  const encoding = await enrollFace(
    req.file.buffer,
    req.file.originalname || "enroll.jpg",
    req.file.mimetype,
  );

  student.faceDescriptor = encoding;
  await student.save();

  res.json({ success: true, message: "Face enrolled successfully" });
});

// Bulk create students from a parsed spreadsheet (Excel import). Each row is
// processed independently so a bad row doesn't block the rest, mirroring
// employeeController.bulkImportEmployees.
const bulkImportStudents = asyncHandler(async (req, res) => {
  const { students: rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400);
    throw new Error("students array is required");
  }
  if (rows.length > 200) {
    res.status(400);
    throw new Error("Maximum 200 students per import");
  }

  const allEmployees = await Employee.find({
    company: req.user.company,
  }).select("firstName lastName");

  let count = await Student.countDocuments({ company: req.user.company });
  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const firstName = (row.firstName || "").trim();
      const lastName = (row.lastName || "").trim();
      const sport = (row.sport || "").trim();

      if (!firstName || !lastName || !sport) {
        results.push({
          row: i + 1,
          status: "error",
          message: "Missing required field (firstName, lastName, sport)",
        });
        continue;
      }

      const coachMatch = row.coach
        ? allEmployees.find(
            (e) =>
              `${e.firstName} ${e.lastName}`.toLowerCase() ===
              String(row.coach).toLowerCase(),
          )
        : undefined;

      const guardians = [];
      if (row.guardianName) {
        guardians.push({
          relation: ["father", "mother", "guardian", "other"].includes(
            row.guardianRelation,
          )
            ? row.guardianRelation
            : "guardian",
          name: String(row.guardianName).trim(),
          phone: row.guardianPhone
            ? String(row.guardianPhone).trim()
            : undefined,
          email: row.guardianEmail
            ? String(row.guardianEmail).trim()
            : undefined,
          // Bulk import only ever creates one guardian per student, so
          // there's no ambiguity — make them the WhatsApp recipient.
          receivesWhatsapp: true,
        });
      }

      count += 1;
      const studentId = `STU${String(count).padStart(4, "0")}`;

      const student = await Student.create({
        company: req.user.company,
        studentId,
        firstName,
        lastName,
        sport,
        batch: row.batch || undefined,
        dateOfBirth: row.dateOfBirth || undefined,
        gender: row.gender || undefined,
        coach: coachMatch?._id || undefined,
        guardians,
        emergencyContact: row.emergencyContact || undefined,
        medicalNotes: row.medicalNotes || undefined,
        enrollmentDate: row.enrollmentDate || Date.now(),
      });

      results.push({
        row: i + 1,
        status: "success",
        studentId: student.studentId,
        name: `${firstName} ${lastName}`,
      });
    } catch (err) {
      results.push({ row: i + 1, status: "error", message: err.message });
    }
  }

  const imported = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;

  res.json({ success: true, imported, failed, results });
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
  bulkImportStudents,
  uploadStudentAvatar,
  uploadGuardianPhotoHandler,
  enrollStudentFace,
};
