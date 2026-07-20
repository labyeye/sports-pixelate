const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const asyncHandler = require("express-async-handler");
const Employee = require("../models/Employee");
const User = require("../models/User");
const {
  escapeRegex,
  safePagination,
  safeSort,
  validateBody,
  validateMongoId,
} = require("../middleware/validate");

const EMPLOYEE_SORT_FIELDS = [
  "firstName",
  "lastName",
  "designation",
  "joinDate",
  "createdAt",
];
const { logAudit } = require("../utils/auditLogger");
const { validateMagicBytes } = require("../middleware/upload");
const { enrollFace } = require("../services/faceService");

const createSchema = {
  firstName: { required: true, type: "string", minLength: 1, maxLength: 80 },
  lastName: { required: true, type: "string", minLength: 1, maxLength: 80 },
  email: { required: true, email: true },
  designation: { required: true, type: "string", minLength: 1, maxLength: 100 },
  joinDate: { required: true, type: "string" },
  role: { enum: ["coach", "staff"] },
};

const updateSchema = {
  firstName: { type: "string", minLength: 1, maxLength: 80 },
  lastName: { type: "string", minLength: 1, maxLength: 80 },
  designation: { type: "string", minLength: 1, maxLength: 100 },
  role: { enum: ["coach", "staff"] },
};

const getEmployees = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { search, department, status, type, role } = req.query;

  const filter = { company: req.user.company };
  if (department) filter.department = department;
  if (type) filter.employmentType = type;
  if (role) filter.role = role;
  if (search) {
    const s = escapeRegex(search.slice(0, 100));
    filter.$or = [
      { firstName: { $regex: s, $options: "i" } },
      { lastName: { $regex: s, $options: "i" } },
      { email: { $regex: s, $options: "i" } },
      { employeeId: { $regex: s, $options: "i" } },
    ];
  }

  // Status counts are computed over the filter WITHOUT status applied, so a
  // client can render "All / Active (12) / On Leave (3) / ..." pills that
  // stay meaningful (and clickable) no matter which status is selected.
  const countRows = await Employee.aggregate([
    { $match: filter },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts = countRows.reduce((acc, r) => {
    acc[r._id] = r.count;
    return acc;
  }, {});

  if (status) filter.status = status;

  const sort = safeSort(req.query, EMPLOYEE_SORT_FIELDS, { createdAt: -1 });
  const total = await Employee.countDocuments(filter);
  const employees = await Employee.find(filter)
    .populate("department", "name code")
    .populate("reportingTo", "firstName lastName")
    .populate("shift", "name startTime endTime")
    .sort(sort)
    .skip(skip)
    .limit(limit);

  // Convert large binary fields to lightweight flags before sending to client
  const data = employees.map((e) => {
    const obj = e.toObject();
    obj.deviceFaceTemplate = !!obj.deviceFaceTemplate;
    return obj;
  });

  res.json({
    success: true,
    data,
    total,
    page,
    pages: Math.ceil(total / limit),
    counts,
  });
});

const getEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    company: req.user.company,
  })
    .populate("department", "name code")
    .populate("reportingTo", "firstName lastName designation");
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }
  res.json({ success: true, data: employee });
});

const getMyEmployee = asyncHandler(async (req, res) => {
  let employee = await Employee.findOne({ user: req.user._id })
    .populate("department", "name code")
    .populate("reportingTo", "firstName lastName designation");

  // Fallback: match by email within the same company if user field isn't linked
  if (!employee && req.user.email && req.user.company) {
    employee = await Employee.findOne({
      email: req.user.email.toLowerCase(),
      company: req.user.company,
    })
      .populate("department", "name code")
      .populate("reportingTo", "firstName lastName designation");

    // Auto-link: update the user field so future lookups are instant
    if (employee) {
      await Employee.findByIdAndUpdate(employee._id, { user: req.user._id });
    }
  }

  if (!employee) {
    res.status(404);
    throw new Error("No employee record linked to your account");
  }
  res.json({ success: true, data: employee });
});

const createEmployee = [
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const {
      firstName,
      lastName,
      email,
      designation,
      joinDate,
      phone,
      department,
      role,
      sport,
      employmentType,
      salary,
      bankAccount,
      accountHolderName,
      ifscCode,
      bankName,
      panNumber,
      aadharNumber,
      uanNumber,
      esicNumber,
      address,
      permanentAddress,
      city,
      state,
      pincode,
      emergencyContact,
      gender,
      dateOfBirth,
      reportingTo,
      avatar,
      shift,
      shiftName,
      isCustomShift,
      customShift,
      fatherName,
      motherName,
      spouseName,
      maritalStatus,
      bloodGroup,
      nationality,
      religion,
      personalEmail,
      alternatePhone,
      qualification,
      totalExperience,
      previousCompany,
    } = req.body;

    const normalizedEmail = email.toLowerCase().trim();

    if (salary !== undefined && (isNaN(Number(salary)) || Number(salary) < 0)) {
      res.status(400);
      throw new Error("Invalid salary value");
    }

    let userId;
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      userId = existingUser._id;
    } else {
      const { password: providedPassword } = req.body;
      const tempPassword =
        providedPassword && providedPassword.length >= 6
          ? providedPassword
          : crypto.randomBytes(8).toString("hex") + "A1";
      const user = await User.create({
        name: `${firstName.trim()} ${lastName.trim()}`,
        email: normalizedEmail,
        password: tempPassword,
        role: "employee",
        company: req.user.company,
      });
      userId = user._id;
    }

    const lastEmp = await Employee.findOne({ company: req.user.company }).sort({
      createdAt: -1,
    });
    const lastNum = lastEmp
      ? parseInt(lastEmp.employeeId?.replace(/\D/g, "") || "0")
      : 0;
    const empId = `EMP${String(lastNum + 1).padStart(4, "0")}`;

    const employee = await Employee.create({
      user: userId,
      company: req.user.company,
      employeeId: empId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      designation: designation.trim(),
      joinDate,
      phone: phone || undefined,
      department: department || undefined,
      role: role || "staff",
      sport: role === "coach" ? sport || "" : "",
      employmentType: employmentType || "full_time",
      salary: salary !== undefined ? Number(salary) : 0,
      bankAccount: bankAccount || undefined,
      accountHolderName: accountHolderName || undefined,
      ifscCode: ifscCode || undefined,
      bankName: bankName || undefined,
      panNumber: panNumber || undefined,
      aadharNumber: aadharNumber || undefined,
      uanNumber: uanNumber || undefined,
      esicNumber: esicNumber || undefined,
      address: address || undefined,
      permanentAddress: permanentAddress || undefined,
      city: city || undefined,
      state: state || undefined,
      pincode: pincode || undefined,
      emergencyContact: emergencyContact || undefined,
      gender: gender || undefined,
      dateOfBirth: dateOfBirth || undefined,
      reportingTo: reportingTo || undefined,
      avatar: avatar || undefined,
      shift: isCustomShift ? undefined : shift || undefined,
      shiftName: isCustomShift ? "Custom" : shiftName || "General",
      isCustomShift: isCustomShift === true,
      customShift: isCustomShift ? customShift : undefined,
      fatherName: fatherName || undefined,
      motherName: motherName || undefined,
      spouseName: spouseName || undefined,
      maritalStatus: maritalStatus || undefined,
      bloodGroup: bloodGroup || undefined,
      nationality: nationality || undefined,
      religion: religion || undefined,
      personalEmail: personalEmail || undefined,
      alternatePhone: alternatePhone || undefined,
      qualification: qualification || undefined,
      totalExperience: totalExperience || undefined,
      previousCompany: previousCompany || undefined,
    });

    await logAudit(req, "employee_created", "Employee", employee._id, {
      employeeId: employee.employeeId,
      name: `${employee.firstName} ${employee.lastName}`,
    });
    res.status(201).json({ success: true, data: employee });
  }),
];

const updateEmployee = [
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const employee = await Employee.findOne({
      _id: req.params.id,
      company: req.user.company,
    });
    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    const allowed = [
      "firstName",
      "lastName",
      "designation",
      "phone",
      "department",
      "role",
      "sport",
      "employmentType",
      "salary",
      "bankAccount",
      "accountHolderName",
      "ifscCode",
      "bankName",
      "panNumber",
      "aadharNumber",
      "uanNumber",
      "esicNumber",
      "address",
      "emergencyContact",
      "gender",
      "dateOfBirth",
      "reportingTo",
      "avatar",
      "status",
      "exitDate",
      "biometricUserId",
      "shift",
      "shiftName",
      "isCustomShift",
      "customShift",
      "workDaysPerWeek",
      "workScheduleType",
      "customWorkDays",
      "otEnabled",
      "otRate",
      "geofenceAttendanceEnabled",
      "geofenceMode",
      "geofenceLat",
      "geofenceLng",
      "geofenceRadiusMeters",
      // Personal details
      "fatherName",
      "motherName",
      "spouseName",
      "maritalStatus",
      "bloodGroup",
      "nationality",
      "religion",
      "personalEmail",
      "alternatePhone",
      "permanentAddress",
      "city",
      "state",
      "pincode",
      // Professional background
      "qualification",
      "totalExperience",
      "previousCompany",
    ];

    // Fields that hold ObjectId references — empty string must become undefined,
    // otherwise Mongoose throws a BSONError trying to cast "" to ObjectId.
    const objectIdFields = new Set(["shift", "department", "reportingTo"]);
    // Fields with a Mongoose enum — "" isn't a valid enum value, so it must
    // become undefined instead of being cast as-is (e.g. cleared bloodGroup).
    const enumFields = new Set([
      "role",
      "employmentType",
      "status",
      "maritalStatus",
      "bloodGroup",
      "gender",
      "workScheduleType",
      "geofenceMode",
    ]);

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        const val = req.body[key];
        employee[key] =
          (objectIdFields.has(key) || enumFields.has(key)) && val === ""
            ? undefined
            : val;
      }
    }

    if (
      employee.salary !== undefined &&
      (isNaN(Number(employee.salary)) || Number(employee.salary) < 0)
    ) {
      res.status(400);
      throw new Error("Invalid salary value");
    }

    await employee.save();
    await employee.populate("department", "name code");
    await logAudit(req, "employee_updated", "Employee", employee._id, {
      employeeId: employee.employeeId,
      name: `${employee.firstName} ${employee.lastName}`,
    });
    res.json({ success: true, data: employee });
  }),
];

const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }
  employee.status = "terminated";
  await employee.save();
  await logAudit(req, "employee_terminated", "Employee", employee._id, {
    employeeId: employee.employeeId,
    name: `${employee.firstName} ${employee.lastName}`,
  });
  res.json({ success: true, message: "Employee terminated" });
});

const resetEmployeePassword = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }

  const { password } = req.body;
  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }
  if (password.length > 128) {
    res.status(400);
    throw new Error("Password too long");
  }

  const linkedUser = await User.findOne({ email: employee.email });
  if (!linkedUser) {
    res.status(404);
    throw new Error("No login account found for this employee");
  }

  linkedUser.password = password;
  await linkedUser.save();

  res.json({ success: true, message: "Password updated successfully" });
});

const bulkImportEmployees = asyncHandler(async (req, res) => {
  const { employees: rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400);
    throw new Error("employees array is required");
  }
  if (rows.length > 200) {
    res.status(400);
    throw new Error("Maximum 200 employees per import");
  }

  const Department = require("../models/Department");
  const Shift = require("../models/Shift");

  const [allDepts, allShifts] = await Promise.all([
    Department.find({ company: req.user.company }),
    Shift.find({ company: req.user.company }),
  ]);

  const lastEmp = await Employee.findOne({ company: req.user.company }).sort({
    createdAt: -1,
  });
  let lastNum = lastEmp
    ? parseInt(lastEmp.employeeId?.replace(/\D/g, "") || "0")
    : 0;

  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const firstName = (row.firstName || "").trim();
      const lastName = (row.lastName || "").trim();
      const email = (row.email || "").toLowerCase().trim();
      const designation = (row.designation || "").trim();
      const joinDate = row.joinDate;

      if (!firstName || !lastName || !email || !designation || !joinDate) {
        results.push({
          row: i + 1,
          status: "error",
          message:
            "Missing required field (firstName, lastName, email, designation, joinDate)",
        });
        continue;
      }

      const deptMatch = allDepts.find(
        (d) => d.name.toLowerCase() === (row.department || "").toLowerCase(),
      );
      const shiftMatch = allShifts.find(
        (s) => s.name.toLowerCase() === (row.shiftName || "").toLowerCase(),
      );

      let userId;
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        userId = existingUser._id;
      } else {
        const tempPassword =
          row.password && row.password.length >= 6
            ? row.password
            : crypto.randomBytes(8).toString("hex") + "A1";
        const user = await User.create({
          name: `${firstName} ${lastName}`,
          email,
          password: tempPassword,
          role: "employee",
          company: req.user.company,
        });
        userId = user._id;
      }

      lastNum += 1;
      const empId = `EMP${String(lastNum).padStart(4, "0")}`;

      const employee = await Employee.create({
        user: userId,
        company: req.user.company,
        employeeId: empId,
        firstName,
        lastName,
        email,
        designation,
        joinDate,
        phone: row.phone || undefined,
        department: deptMatch?._id || undefined,
        role: row.role === "coach" ? "coach" : "staff",
        employmentType: row.employmentType || "full_time",
        salary: Number(row.salary) || 0,
        gender: row.gender || undefined,
        dateOfBirth: row.dateOfBirth || undefined,
        address: row.address || undefined,
        emergencyContact: row.emergencyContact || undefined,
        bankAccount: row.bankAccount || undefined,
        accountHolderName: row.accountHolderName || undefined,
        ifscCode: row.ifscCode || undefined,
        bankName: row.bankName || undefined,
        panNumber: row.panNumber || undefined,
        aadharNumber: row.aadharNumber || undefined,
        uanNumber: row.uanNumber || undefined,
        esicNumber: row.esicNumber || undefined,
        pfNumber: row.pfNumber || undefined,
        shift: shiftMatch?._id || undefined,
        shiftName: shiftMatch?.name || row.shiftName || "General",
      });

      results.push({
        row: i + 1,
        status: "success",
        employeeId: employee.employeeId,
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

// POST /employees/:id/documents  (multipart via multer)
const uploadEmployeeDocuments = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }

  const files = req.files || {};
  const saveDoc = async (field, empField) => {
    if (!files[field]?.[0]) return;
    await validateMagicBytes(files[field][0].path); // throws + deletes file if invalid
    if (employee[empField]) {
      const old = path.join(__dirname, "../", employee[empField]);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    employee[empField] = path
      .relative(path.join(__dirname, "../"), files[field][0].path)
      .replace(/\\/g, "/");
  };

  await saveDoc("aadhaarDoc", "aadhaarDoc");
  await saveDoc("panDoc", "panDoc");
  await saveDoc("resumeDoc", "resumeDoc");

  await employee.save();
  res.json({
    success: true,
    data: {
      aadhaarDoc: employee.aadhaarDoc || null,
      panDoc: employee.panDoc || null,
      resumeDoc: employee.resumeDoc || null,
    },
  });
});

// GET /employees/:id/documents/:type  — protected file download
const downloadEmployeeDocument = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }

  const { type } = req.params;
  const docPath =
    type === "aadhaar"
      ? employee.aadhaarDoc
      : type === "pan"
        ? employee.panDoc
        : type === "resume"
          ? employee.resumeDoc
          : null;

  if (!docPath) {
    res.status(404);
    throw new Error("Document not found");
  }

  const uploadsRoot = path.resolve(__dirname, "../uploads");
  const abs = path.resolve(__dirname, "../", docPath);

  if (!abs.startsWith(uploadsRoot + path.sep) && abs !== uploadsRoot) {
    res.status(403);
    throw new Error("Access denied");
  }

  if (!fs.existsSync(abs)) {
    res.status(404);
    throw new Error("File missing on server");
  }

  res.download(abs);
});

// Enrolls (or re-enrolls) the employee's face embedding for mobile geofenced
// attendance verification, using the internal face-recognition microservice.
// The uploaded photo itself is never persisted — only the resulting embedding.
const enrollEmployeeFace = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
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

  employee.faceDescriptor = encoding;
  await employee.save();

  res.json({ success: true, message: "Face enrolled successfully" });
});

// Self-service version for the mobile app: the logged-in employee enrolls
// their own face using a live camera capture (never a gallery photo), so the
// enrolled embedding is captured under the same conditions as check-in
// selfies, which keeps verification accuracy consistent.
const enrollMyFace = asyncHandler(async (req, res) => {
  let employee = await Employee.findOne({ user: req.user._id });
  if (!employee && req.user.email && req.user.company) {
    employee = await Employee.findOne({
      email: req.user.email.toLowerCase(),
      company: req.user.company,
    });
  }
  if (!employee) {
    res.status(404);
    throw new Error("Employee record not found");
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

  employee.faceDescriptor = encoding;
  await employee.save();

  res.json({ success: true, message: "Face enrolled successfully" });
});

module.exports = {
  getEmployees,
  getEmployee,
  getMyEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  resetEmployeePassword,
  bulkImportEmployees,
  uploadEmployeeDocuments,
  downloadEmployeeDocument,
  enrollEmployeeFace,
  enrollMyFace,
};
