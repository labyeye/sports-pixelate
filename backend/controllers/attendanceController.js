const asyncHandler = require("express-async-handler");
const fs = require("fs");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const Shift = require("../models/Shift");
const DeductionRule = require("../models/DeductionRule");
const AttendanceBalance = require("../models/AttendanceBalance");
const LateApproval = require("../models/LateApproval");
const { isHolidayDate } = require("./holidayController");
const { safePagination } = require("../middleware/validate");
const { sendAttendanceStatus } = require("../services/whatsappService");
const { validateMagicBytes } = require("../middleware/upload");
const { verifyFace } = require("../services/faceService");

// Great-circle distance between two lat/lng points, in meters.
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Returns an error message if `date` falls outside the employee's employment
// period (before joinDate or after exitDate), or null if it's in bounds.
function employmentBoundsError(emp, date) {
  if (emp.joinDate) {
    const jd = new Date(emp.joinDate);
    jd.setHours(0, 0, 0, 0);
    if (date < jd)
      return "Cannot mark attendance before the employee's join date";
  }
  if (emp.exitDate) {
    const ed = new Date(emp.exitDate);
    ed.setHours(0, 0, 0, 0);
    if (date > ed)
      return "Cannot mark attendance after the employee's exit date";
  }
  return null;
}

async function notifyAttendanceStatus(emp, date, status, companyId) {
  if (!emp?.phone) return;
  await sendAttendanceStatus(
    emp.phone,
    { firstName: emp.firstName, date, status },
    companyId,
  );
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

// Reads the company's configured grace period (falls back to 15 min if no
// DeductionRule exists yet). Queried per-call — no cross-request cache needed
// at this volume.
async function getGraceMinutes(companyId) {
  if (!companyId) return 15;
  const rule = await DeductionRule.findOne({ company: companyId }).select(
    "lateThresholdMinutes",
  );
  return rule?.lateThresholdMinutes ?? 15;
}

// Resolves the shift doc/subdoc (custom-per-employee or company Shift ref) to use
// for this employee, or null if none is configured.
async function resolveShift(emp) {
  if (emp.isCustomShift && emp.customShift?.endTime) {
    return emp.customShift;
  }
  if (emp.shift) {
    return typeof emp.shift === "object" && emp.shift.endTime
      ? emp.shift
      : await Shift.findById(emp.shift).select("startTime endTime");
  }
  return null;
}

// Converts a shift's "HH:MM" end time + the attendance date (from checkOutISO)
// into an absolute UTC timestamp, for comparison against the actual checkout time.
// Use Date.UTC() so the result is always UTC midnight regardless of server timezone —
// new Date(y, m, d) uses local timezone which double-counts IST offset on IST servers.
function shiftEndUTC(endTimeStr, checkOutISO) {
  const [endH, endM] = endTimeStr.split(":").map(Number);
  const checkOutDate = new Date(checkOutISO);
  const utcMidnight = Date.UTC(
    checkOutDate.getUTCFullYear(),
    checkOutDate.getUTCMonth(),
    checkOutDate.getUTCDate(),
  );
  const istMidnight = utcMidnight - IST_OFFSET_MS;
  return istMidnight + (endH * 60 + endM) * 60000;
}

// Returns auto-calculated OT hours based on checkout vs shift end.
// Returns 0 if OT is not enabled or checkout doesn't exceed shift end.
async function calcOTHours(emp, checkOutISO) {
  if (!emp.otEnabled) return 0;
  if (!checkOutISO) return 0;

  const shift = await resolveShift(emp);
  const endTimeStr = shift?.endTime;
  if (!endTimeStr) return 0;

  const checkOutUTC = new Date(checkOutISO).getTime();
  const otMs = checkOutUTC - shiftEndUTC(endTimeStr, checkOutISO);
  if (otMs <= 0) return 0;

  return parseFloat((otMs / 3_600_000).toFixed(2));
}

// Returns true if checkout happened more than the company's grace period before shift end.
// Returns false if there's no shift configured or no checkout time.
async function calcEarlyLeaving(emp, checkOutISO, companyId) {
  if (!checkOutISO) return false;

  const shift = await resolveShift(emp);
  const endTimeStr = shift?.endTime;
  if (!endTimeStr) return false;

  const graceMinutes = await getGraceMinutes(companyId || emp.company);
  const checkOutUTC = new Date(checkOutISO).getTime();
  const earlyMs = shiftEndUTC(endTimeStr, checkOutISO) - checkOutUTC;
  return earlyMs > graceMinutes * 60000;
}

async function resolveStatus(employeeId, checkIn, requestedStatus, companyId) {
  // Only auto-promote present → late; never override an explicit absent/leave/etc.
  if (!checkIn || requestedStatus !== "present") return requestedStatus;

  const emp = await Employee.findById(employeeId).select(
    "shift isCustomShift customShift company",
  );
  if (!emp) return requestedStatus;

  const shift =
    emp.isCustomShift && emp.customShift?.startTime
      ? emp.customShift
      : emp.shift
        ? await Shift.findById(emp.shift).select("startTime")
        : null;
  if (!shift?.startTime) return requestedStatus;

  const [shiftH, shiftM] = shift.startTime.split(":").map(Number);
  const shiftStartMinutes = shiftH * 60 + shiftM;

  // Convert stored UTC time → IST to compare against shift start (which is local IST)
  const checkInIST = new Date(new Date(checkIn).getTime() + IST_OFFSET_MS);
  const checkInMinutes =
    checkInIST.getUTCHours() * 60 + checkInIST.getUTCMinutes();

  const graceMinutes = await getGraceMinutes(companyId || emp.company);
  return checkInMinutes > shiftStartMinutes + graceMinutes
    ? "late"
    : requestedStatus;
}

// Minutes the check-in was past shift start (negative/0 if on time). Duplicates
// part of resolveStatus's math but returns a number instead of a status string.
async function computeMinutesLate(employeeId, checkIn) {
  const emp = await Employee.findById(employeeId).select(
    "shift isCustomShift customShift",
  );
  if (!emp) return 0;
  const shift =
    emp.isCustomShift && emp.customShift?.startTime
      ? emp.customShift
      : emp.shift
        ? await Shift.findById(emp.shift).select("startTime")
        : null;
  if (!shift?.startTime) return 0;
  const [shiftH, shiftM] = shift.startTime.split(":").map(Number);
  const shiftStartMinutes = shiftH * 60 + shiftM;
  const checkInIST = new Date(new Date(checkIn).getTime() + IST_OFFSET_MS);
  const checkInMinutes =
    checkInIST.getUTCHours() * 60 + checkInIST.getUTCMinutes();
  return checkInMinutes - shiftStartMinutes;
}

// Called when an employee checks in late (beyond the company's grace period).
// If they still have late allowance left this month, consume it silently
// (no deduction). Otherwise, park the record in the HR/Admin approval queue
// instead of finalizing it as "late".
async function handleLateAllowance(employeeId, companyId, date, checkIn) {
  const balance = await AttendanceBalance.getOrCreateCurrentMonth(
    employeeId,
    companyId,
  );
  if (balance.lateUsed < balance.lateAllowed) {
    balance.lateUsed += 1;
    await balance.save();
    return false;
  }
  const minutesLate = await computeMinutesLate(employeeId, checkIn);
  await LateApproval.create({
    employee: employeeId,
    company: companyId,
    date,
    checkInTime: checkIn,
    minutesLate,
  });
  return true;
}

const getAttendance = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query, 50, 200);
  const { month, year, employeeId, department } = req.query;

  if (req.user.role === "employee") {
    let selfEmp = await Employee.findOne({ user: req.user._id }).select("_id");
    if (!selfEmp && req.user.email && req.user.company) {
      selfEmp = await Employee.findOne({
        email: req.user.email.toLowerCase(),
        company: req.user.company,
      }).select("_id");
      if (selfEmp) {
        await Employee.findByIdAndUpdate(selfEmp._id, { user: req.user._id });
      }
    }
    if (!selfEmp) return res.json({ success: true, data: [], total: 0 });
    const filter = { employee: selfEmp._id };
    if (month && year) {
      const m = parseInt(month),
        y = parseInt(year);
      if (!isNaN(m) && !isNaN(y))
        filter.date = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0) };
    }
    const total = await Attendance.countDocuments(filter);
    const records = await Attendance.find(filter)
      .populate({
        path: "employee",
        select: "firstName lastName employeeId designation department avatar",
        populate: { path: "department", select: "name" },
      })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);
    return res.json({
      success: true,
      data: records,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  }

  const companyEmployees = await Employee.find({
    company: req.user.company,
  }).select("_id");
  const companyEmpIds = companyEmployees.map((e) => e._id);

  const filter = { employee: { $in: companyEmpIds } };

  if (employeeId) {
    if (!companyEmpIds.some((id) => id.toString() === employeeId)) {
      return res.json({ success: true, data: [], total: 0 });
    }
    filter.employee = employeeId;
  }

  if (department) {
    const deptEmployees = await Employee.find({
      company: req.user.company,
      department,
    }).select("_id");
    filter.employee = { $in: deptEmployees.map((e) => e._id) };
  }

  if (month && year) {
    const m = parseInt(month),
      y = parseInt(year);
    if (!isNaN(m) && !isNaN(y)) {
      filter.date = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0) };
    }
  }

  const total = await Attendance.countDocuments(filter);
  const records = await Attendance.find(filter)
    .populate({
      path: "employee",
      select: "firstName lastName employeeId designation department avatar",
      populate: { path: "department", select: "name" },
    })
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: records,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const markAttendance = asyncHandler(async (req, res) => {
  const { employee, date, status, checkIn, checkOut, notes, verifyMode } =
    req.body;

  const emp = await Employee.findOne({
    _id: employee,
    company: req.user.company,
  });
  if (!emp) {
    res.status(404);
    throw new Error("Employee not found");
  }

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const boundsError = employmentBoundsError(emp, d);
  if (boundsError) {
    res.status(400);
    throw new Error(boundsError);
  }

  const holiday = await isHolidayDate(req.user.company, d);
  const computedStatus = holiday
    ? "holiday"
    : await resolveStatus(employee, checkIn, status, req.user.company);

  let approvalPending = false;
  if (computedStatus === "late") {
    approvalPending = await handleLateAllowance(
      employee,
      req.user.company,
      d,
      checkIn,
    );
  }

  let workHours = 0;
  let autoOT = 0;
  let earlyLeaving = false;
  if (checkIn && checkOut && !holiday) {
    workHours = (new Date(checkOut) - new Date(checkIn)) / 3600000;
    autoOT = await calcOTHours(emp, checkOut);
    earlyLeaving = await calcEarlyLeaving(emp, checkOut, req.user.company);
  }

  const record = await Attendance.findOneAndUpdate(
    { employee, date: d },
    {
      employee,
      date: d,
      status: computedStatus,
      checkIn: holiday ? undefined : checkIn,
      checkOut: holiday ? undefined : checkOut,
      workHours,
      overtime: autoOT,
      earlyLeaving,
      approvalPending,
      verifyMode: verifyMode || "manual",
      notes: holiday ? `Holiday: ${holiday.name}` : notes || undefined,
      markedBy: req.user._id,
    },
    { upsert: true, new: true },
  ).populate({
    path: "employee",
    select: "firstName lastName employeeId designation department avatar phone",
    populate: { path: "department", select: "name" },
  });

  // Send WA notification for actionable statuses (not holiday/weekend/on_leave)
  await notifyAttendanceStatus(
    record.employee,
    d,
    computedStatus,
    req.user.company,
  );

  res.json({ success: true, data: record });
});

// Employee self check-in/check-out from the mobile app: requires a live selfie +
// GPS location, and only succeeds if the employee has geofenced attendance enabled
// and is within their configured radius. Location is always re-validated server-side.
const selfMarkAttendance = asyncHandler(async (req, res) => {
  const cleanup = () => {
    if (req.file) fs.unlink(req.file.path, () => {});
  };

  const emp = await Employee.findOne({
    user: req.user._id,
    company: req.user.company,
  });
  if (!emp) {
    cleanup();
    res.status(404);
    throw new Error("Employee record not found");
  }

  if (!emp.geofenceAttendanceEnabled) {
    cleanup();
    res.status(403);
    throw new Error("Geofenced mobile attendance is not enabled for you");
  }

  const geofenceMode = emp.geofenceMode || "specific";
  if (
    geofenceMode === "specific" &&
    (emp.geofenceLat == null || emp.geofenceLng == null)
  ) {
    cleanup();
    res.status(400);
    throw new Error("Geofence location has not been configured for you");
  }

  if (!req.file) {
    res.status(400);
    throw new Error("Selfie photo is required");
  }

  try {
    await validateMagicBytes(req.file.path); // throws + deletes file if invalid
  } catch (err) {
    res.status(400);
    throw err;
  }

  const { action } = req.body;
  const lat = parseFloat(req.body.lat);
  const lng = parseFloat(req.body.lng);
  const accuracy = req.body.accuracy
    ? parseFloat(req.body.accuracy)
    : undefined;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    cleanup();
    res.status(400);
    throw new Error("Valid location coordinates are required");
  }
  if (!["checkin", "checkout"].includes(action)) {
    cleanup();
    res.status(400);
    throw new Error("action must be 'checkin' or 'checkout'");
  }

  // "any" mode still records the employee's GPS location for audit purposes,
  // but doesn't restrict where they can check in/out from.
  const distanceMeters =
    geofenceMode === "specific"
      ? haversineMeters(lat, lng, emp.geofenceLat, emp.geofenceLng)
      : null;
  if (
    geofenceMode === "specific" &&
    distanceMeters > emp.geofenceRadiusMeters
  ) {
    cleanup();
    res.status(403);
    throw new Error(
      `You are ${Math.round(distanceMeters)}m away from the allowed location (max ${emp.geofenceRadiusMeters}m)`,
    );
  }

  if (!Array.isArray(emp.faceDescriptor) || emp.faceDescriptor.length !== 128) {
    cleanup();
    res.status(400);
    throw new Error(
      "Face not enrolled for you. Contact HR to enable mobile attendance.",
    );
  }

  const { match, distance } = await verifyFace(
    fs.readFileSync(req.file.path),
    req.file.filename,
    req.file.mimetype,
    emp.faceDescriptor,
  );
  if (!match) {
    cleanup();
    res.status(403);
    throw new Error(
      `Face does not match enrolled records (distance: ${distance.toFixed(3)})`,
    );
  }

  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  const holiday = await isHolidayDate(req.user.company, d);
  const selfieUrl = `${req.protocol}://${req.get("host")}/uploads/attendance-selfies/${req.file.filename}`;
  const location = { lat, lng, accuracy, distanceMeters };

  let record = await Attendance.findOne({ employee: emp._id, date: d });

  if (action === "checkin") {
    if (record?.checkIn) {
      cleanup();
      res.status(400);
      throw new Error("Already checked in today");
    }
    const computedStatus = holiday
      ? "holiday"
      : await resolveStatus(emp._id, now, "present", req.user.company);

    let approvalPending = false;
    if (computedStatus === "late") {
      approvalPending = await handleLateAllowance(
        emp._id,
        req.user.company,
        d,
        now,
      );
    }

    record = await Attendance.findOneAndUpdate(
      { employee: emp._id, date: d },
      {
        employee: emp._id,
        date: d,
        status: computedStatus,
        checkIn: holiday ? undefined : now,
        approvalPending,
        verifyMode: "geo_camera",
        checkInSelfie: selfieUrl,
        checkInLocation: location,
        markedBy: req.user._id,
      },
      { upsert: true, new: true },
    );
  } else {
    if (!record?.checkIn) {
      cleanup();
      res.status(400);
      throw new Error("You must check in before checking out");
    }
    if (record.checkOut) {
      cleanup();
      res.status(400);
      throw new Error("Already checked out today");
    }
    const workHours = (now - record.checkIn) / 3600000;
    const autoOT = await calcOTHours(emp, now.toISOString());
    const earlyLeaving = await calcEarlyLeaving(
      emp,
      now.toISOString(),
      req.user.company,
    );

    record = await Attendance.findOneAndUpdate(
      { employee: emp._id, date: d },
      {
        checkOut: now,
        workHours,
        overtime: autoOT,
        earlyLeaving,
        checkOutSelfie: selfieUrl,
        checkOutLocation: location,
      },
      { new: true },
    );
  }

  await notifyAttendanceStatus(emp, d, record.status, req.user.company);

  res.json({ success: true, data: record });
});

const updateAttendance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, checkIn, checkOut, notes, overtime, date, verifyMode } =
    req.body;

  const companyEmployees = await Employee.find({
    company: req.user.company,
  }).select("_id");
  const companyEmpIds = new Set(companyEmployees.map((e) => e._id.toString()));

  const record = await Attendance.findById(id).populate("employee", "_id");
  if (!record || !companyEmpIds.has(record.employee._id.toString())) {
    res.status(404);
    throw new Error("Attendance record not found");
  }

  // Load employee with shift for OT calculation
  const empForOT = await Employee.findById(record.employee._id)
    .populate("shift", "endTime")
    .select("otEnabled shift isCustomShift customShift");

  // Note: record.date is intentionally not updated — it's part of the unique compound
  // index (employee + date) and changing it would cause duplicate key errors.
  if (checkIn !== undefined)
    record.checkIn = checkIn ? new Date(checkIn) : undefined;
  if (checkOut !== undefined)
    record.checkOut = checkOut ? new Date(checkOut) : undefined;
  if (notes !== undefined) record.notes = notes;
  if (verifyMode !== undefined) record.verifyMode = verifyMode;

  // If admin picked an explicit non-present status, honour it.
  // If status is "present" (or not sent), auto-resolve based on updated checkIn
  // so that a late punch correctly becomes "late".
  const explicitNonPresent = status !== undefined && status !== "present";
  if (explicitNonPresent) {
    record.status = status;
  } else if (record.checkIn) {
    record.status = await resolveStatus(
      record.employee._id,
      record.checkIn,
      "present",
      req.user.company,
    );
  } else if (status !== undefined) {
    record.status = status;
  }

  if (record.checkIn && record.checkOut) {
    record.workHours = parseFloat(
      ((record.checkOut - record.checkIn) / 3_600_000).toFixed(2),
    );
    // If overtime was manually provided, honour it; otherwise auto-calculate from shift end
    if (overtime !== undefined) {
      record.overtime = parseFloat(overtime) || 0;
    } else if (empForOT) {
      record.overtime = await calcOTHours(
        empForOT,
        record.checkOut.toISOString(),
      );
    }
    record.earlyLeaving = empForOT
      ? await calcEarlyLeaving(
          empForOT,
          record.checkOut.toISOString(),
          req.user.company,
        )
      : false;
  } else if (overtime !== undefined) {
    record.overtime = parseFloat(overtime) || 0;
  }

  record.markedBy = req.user._id;
  await record.save();

  await record.populate({
    path: "employee",
    select: "firstName lastName employeeId designation department avatar phone",
    populate: { path: "department", select: "name" },
  });

  await notifyAttendanceStatus(
    record.employee,
    record.date,
    record.status,
    req.user.company,
  );

  res.json({ success: true, data: record });
});

const bulkMarkAttendance = asyncHandler(async (req, res) => {
  const { date, records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    res.status(400);
    throw new Error("records must be a non-empty array");
  }
  if (records.length > 500) {
    res.status(400);
    throw new Error("Cannot bulk mark more than 500 records at once");
  }

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const holiday = await isHolidayDate(req.user.company, d);

  const companyEmployees = await Employee.find({
    company: req.user.company,
  }).select("_id joinDate exitDate");
  const companyEmpMap = new Map(
    companyEmployees.map((e) => [e._id.toString(), e]),
  );
  const filteredRecords = records.filter((r) => {
    if (!r.employee) return false;
    const emp = companyEmpMap.get(r.employee.toString());
    if (!emp) return false;
    return !employmentBoundsError(emp, d);
  });

  const ops = filteredRecords.map((r) => ({
    updateOne: {
      filter: { employee: r.employee, date: d },
      update: {
        $set: {
          status: holiday ? "holiday" : r.status,
          checkIn: holiday ? undefined : r.checkIn,
          checkOut: holiday ? undefined : r.checkOut,
          notes: holiday ? `Holiday: ${holiday.name}` : undefined,
          markedBy: req.user._id,
        },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) await Attendance.bulkWrite(ops);
  res.json({
    success: true,
    message: holiday
      ? `Marked as holiday: ${holiday.name}`
      : "Attendance marked",
  });
});

const getMonthSummary = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const m = parseInt(month),
    y = parseInt(year);
  if (isNaN(m) || isNaN(y)) {
    res.status(400);
    throw new Error("Valid month and year are required");
  }

  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);

  const companyEmployees = await Employee.find({
    company: req.user.company,
  }).select("_id");
  const companyEmpIds = companyEmployees.map((e) => e._id);

  const summary = await Attendance.aggregate([
    {
      $match: {
        employee: { $in: companyEmpIds },
        date: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  res.json({ success: true, data: summary });
});

module.exports = {
  getAttendance,
  markAttendance,
  selfMarkAttendance,
  updateAttendance,
  bulkMarkAttendance,
  getMonthSummary,
  handleLateAllowance,
};
