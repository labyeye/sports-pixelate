const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const BiometricLocation = require("../models/BiometricLocation");
const BiometricDevice = require("../models/BiometricDevice");
const BiometricCommand = require("../models/BiometricCommand");
const BiometricLog = require("../models/BiometricLog");
const Attendance = require("../models/Attendance");
const StudentAttendance = require("../models/StudentAttendance");
const Employee = require("../models/Employee");
const Student = require("../models/Student");
const User = require("../models/User");
const { safePagination } = require("../middleware/validate");
const { isHolidayDate } = require("./holidayController");
const {
  sendCheckIn,
  sendCheckOut,
  sendCheckInHR,
  sendCheckOutHR,
  sendStudentCheckIn,
  sendStudentCheckOut,
} = require("../services/whatsappService");
const { sendPushToEmployee } = require("../services/pushNotificationService");
const { getEffectiveCheckOut } = require("../utils/shiftUtils");
const { toDateOnly } = require("../utils/dateOnly");
const {
  personModelFor,
  personModelName,
  isBiometricIdTaken,
  isRfidCardTaken,
} = require("../utils/biometricPerson");

function buildSetUserCmd(person) {
  const uid = person.biometricUserId;

  const rawName = `${person.firstName || ""} ${person.lastName || ""}`;

  // Strip non-printable and non-ASCII characters — ZKTeco firmware only accepts ASCII names
  const asciiName = rawName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacritics
    .replace(/[^\x20-\x7E]/g, "") // strip anything outside printable ASCII
    .replace(/\s+/g, " ")
    .trim();

  const name = (asciiName || `User-${uid}`).slice(0, 24);
  const card = (person.rfidCard || "").replace(/[^\x20-\x7E]/g, "");

  return `DATA UPDATE USERINFO PIN=${uid}\tName=${name}\tPri=0\tPasswd=\tCard=${card}\tGrp=1\tTZ=0\tVerify=0\t`;
}

async function nextCmdId(deviceId) {
  const last = await BiometricCommand.findOne({ device: deviceId })
    .sort({ cmdId: -1 })
    .select("cmdId");
  return (last?.cmdId || 0) + 1;
}

async function findPerson(personType, id, company) {
  const Model = personModelFor(personType);
  return Model.findOne({ _id: id, company });
}

async function notifyHR(
  employee,
  logType,
  locationName,
  time,
  workHours,
  companyId,
) {
  const hrUsers = await User.find({
    company: companyId,
    role: { $in: ["super_admin", "hr_manager"] },
  }).select("phone");
  const empFullName = `${employee.firstName} ${employee.lastName}`;

  if (logType === "check_in") {
    if (employee.phone) {
      await sendCheckIn(
        employee.phone,
        { firstName: employee.firstName, locationName, time },
        companyId,
      );
    }
    for (const hr of hrUsers) {
      if (hr.phone) {
        await sendCheckInHR(
          hr.phone,
          {
            empName: empFullName,
            empId: employee.employeeId,
            locationName,
            time,
          },
          companyId,
        );
      }
    }
  } else {
    if (employee.phone) {
      await sendCheckOut(
        employee.phone,
        { firstName: employee.firstName, locationName, time, workHours },
        companyId,
      );
    }
    for (const hr of hrUsers) {
      if (hr.phone) {
        await sendCheckOutHR(
          hr.phone,
          {
            empName: empFullName,
            empId: employee.employeeId,
            locationName,
            time,
            workHours,
          },
          companyId,
        );
      }
    }
  }
}

async function notifyGuardians(student, logType, locationName, time) {
  const sendFn =
    logType === "check_in" ? sendStudentCheckIn : sendStudentCheckOut;
  const studentName = `${student.firstName} ${student.lastName}`;
  // Only the one guardian opted in via receivesWhatsapp gets notified —
  // otherwise every listed guardian (father, mother, etc.) would be messaged.
  const guardian = (student.guardians || []).find(
    (g) => g.receivesWhatsapp && g.phone,
  );
  if (!guardian) return;
  await sendFn(
    guardian.phone,
    { guardianName: guardian.name, studentName, locationName, time },
    student.company,
  );
}

// ─── Locations ──────────────────────────────────────────────────────────────

const getLocations = asyncHandler(async (req, res) => {
  const locations = await BiometricLocation.find({
    company: req.user.company,
  }).sort({ createdAt: -1 });
  res.json({ success: true, data: locations });
});

const createLocation = asyncHandler(async (req, res) => {
  const { name, address, description } = req.body;
  if (!name) {
    res.status(400);
    throw new Error("Location name is required");
  }
  const location = await BiometricLocation.create({
    company: req.user.company,
    name,
    address,
    description,
  });
  res.status(201).json({ success: true, data: location });
});

const updateLocation = asyncHandler(async (req, res) => {
  const location = await BiometricLocation.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!location) {
    res.status(404);
    throw new Error("Location not found");
  }
  const { name, address, description, isActive } = req.body;
  if (name !== undefined) location.name = name;
  if (address !== undefined) location.address = address;
  if (description !== undefined) location.description = description;
  if (isActive !== undefined) location.isActive = isActive;
  await location.save();
  res.json({ success: true, data: location });
});

const deleteLocation = asyncHandler(async (req, res) => {
  const location = await BiometricLocation.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!location) {
    res.status(404);
    throw new Error("Location not found");
  }
  await BiometricDevice.updateMany(
    { location: location._id },
    { isActive: false },
  );
  await location.deleteOne();
  res.json({ success: true, message: "Location deleted" });
});

// ─── Devices ────────────────────────────────────────────────────────────────

const getDevices = asyncHandler(async (req, res) => {
  const devices = await BiometricDevice.find({ company: req.user.company })
    .populate("location", "name address")
    .populate("nfcCards.person", "firstName lastName employeeId studentId")
    .sort({ createdAt: -1 });
  res.json({ success: true, data: devices });
});

const createDevice = asyncHandler(async (req, res) => {
  const { name, location } = req.body;
  if (!name || !location) {
    res.status(400);
    throw new Error("Name and location are required");
  }
  const loc = await BiometricLocation.findOne({
    _id: location,
    company: req.user.company,
  });
  if (!loc) {
    res.status(404);
    throw new Error("Location not found");
  }
  const device = await BiometricDevice.create({
    company: req.user.company,
    location,
    name,
  });
  await device.populate("location", "name address");
  res.status(201).json({ success: true, data: device });
});

const updateDevice = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  const { name, isActive } = req.body;
  if (name !== undefined) device.name = name;
  if (isActive !== undefined) device.isActive = isActive;
  await device.save();
  res.json({ success: true, data: device });
});

const deleteDevice = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  await device.deleteOne();
  res.json({ success: true, message: "Device deleted" });
});

const regenerateDeviceToken = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  device.deviceToken = crypto.randomBytes(32).toString("hex");
  device.activationCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  device.activated = false;
  device.activatedAt = undefined;
  await device.save();
  res.json({
    success: true,
    data: {
      deviceToken: device.deviceToken,
      activationCode: device.activationCode,
    },
  });
});

const assignNfcCard = asyncHandler(async (req, res) => {
  const { uid, personType, personId, label } = req.body;
  if (!uid || !personType || !personId) {
    res.status(400);
    throw new Error("NFC UID, personType and personId are required");
  }

  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }

  const person = await findPerson(personType, personId, req.user.company);
  if (!person) {
    res.status(404);
    throw new Error("Employee/student not found");
  }

  const existingDevice = await BiometricDevice.findOne({
    company: req.user.company,
    "nfcCards.uid": uid,
  });
  if (existingDevice) {
    res.status(400);
    throw new Error("This NFC card UID is already assigned");
  }

  if (device.nfcCards.length >= 10) {
    res.status(400);
    throw new Error("Maximum 10 NFC cards per device");
  }

  device.nfcCards.push({
    uid,
    personType,
    personModel: personModelName(personType),
    person: personId,
    label,
  });
  await device.save();
  await device.populate(
    "nfcCards.person",
    "firstName lastName employeeId studentId",
  );
  res.json({ success: true, data: device });
});

const removeNfcCard = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  device.nfcCards = device.nfcCards.filter((c) => c.uid !== req.params.uid);
  await device.save();
  res.json({ success: true, data: device });
});

// ─── Device-facing (unauthenticated, token-based) ──────────────────────────

const registerDevice = asyncHandler(async (req, res) => {
  const { activationCode, model, mac, ip } = req.body;
  if (!activationCode) {
    res.status(400);
    throw new Error("activationCode is required");
  }

  const device = await BiometricDevice.findOne({
    activationCode: activationCode.toUpperCase().trim(),
    isActive: true,
  }).populate("location", "name address");

  if (!device) {
    res.status(404);
    throw new Error("Invalid activation code");
  }

  device.activated = true;
  device.activatedAt = new Date();
  device.lastSeenAt = new Date();
  if (model) device.deviceMeta.model = model;
  if (mac) device.deviceMeta.mac = mac;
  if (ip) device.deviceMeta.ip = ip;
  await device.save();

  res.json({
    success: true,
    data: {
      deviceToken: device.deviceToken,
      deviceName: device.name,
      location: device.location?.name,
      nfcUids: device.nfcCards.map((c) => c.uid),
    },
  });
});

const getDeviceInfo = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    deviceToken: req.params.token,
    isActive: true,
  })
    .populate("location", "name address")
    .populate("nfcCards.person", "firstName lastName employeeId studentId");
  if (!device) {
    res.status(404);
    throw new Error("Device not found or inactive");
  }
  device.lastSeenAt = new Date();
  await device.save();

  res.json({
    success: true,
    data: {
      _id: device._id,
      name: device.name,
      location: device.location,
      nfcUids: device.nfcCards.map((c) => c.uid),
    },
  });
});

const recordBiometric = asyncHandler(async (req, res) => {
  const { deviceToken, method, nfcUid, personType, personId, type } = req.body;

  const device = await BiometricDevice.findOne({
    deviceToken,
    isActive: true,
  }).populate("location");
  if (!device) {
    res.status(404);
    throw new Error("Device not found or inactive");
  }

  let effectiveType = personType;
  let effectiveId = personId;

  if (method === "nfc") {
    if (!nfcUid) {
      res.status(400);
      throw new Error("NFC UID is required");
    }
    const card = device.nfcCards.find((c) => c.uid === nfcUid);
    if (!card) {
      res.status(404);
      throw new Error("NFC card not registered on this device");
    }
    effectiveType = card.personType;
    effectiveId = card.person;
  } else if (method === "pin" || method === "face") {
    if (!effectiveType || !effectiveId) {
      res.status(400);
      throw new Error("personType and personId are required");
    }
  } else {
    res.status(400);
    throw new Error("Invalid method");
  }

  const person = await findPerson(effectiveType, effectiveId, device.company);
  if (!person) {
    res.status(404);
    throw new Error("Employee/student not found");
  }

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const lastTodayLog = await BiometricLog.findOne({
    personType: effectiveType,
    person: person._id,
    timestamp: { $gte: today },
  }).sort({ timestamp: -1 });

  const personLabel = {
    name: `${person.firstName} ${person.lastName}`,
    code: effectiveType === "employee" ? person.employeeId : person.studentId,
  };

  if (lastTodayLog?.type === "check_out") {
    return res.json({
      success: true,
      locked: true,
      data: {
        person: personLabel,
        type: "check_out",
        message: "Already checked out for today",
        checkedOutAt: lastTodayLog.timestamp,
        location: device.location.name,
      },
    });
  }

  let logType = type;
  if (!logType) {
    logType = lastTodayLog?.type === "check_in" ? "check_out" : "check_in";
  }

  if (logType === "check_in" && lastTodayLog?.type === "check_in") {
    return res.json({
      success: true,
      locked: true,
      data: {
        person: personLabel,
        type: "check_in",
        message: "Already checked in, awaiting check-out",
        checkedInAt: lastTodayLog.timestamp,
        location: device.location.name,
      },
    });
  }

  let attendance;
  let workHours;

  if (effectiveType === "employee") {
    const holiday = await isHolidayDate(device.company, today);
    const attendanceUpdate = {
      employee: person._id,
      date: today,
      markedBy: null,
    };

    if (holiday) {
      attendanceUpdate.status = "holiday";
      attendanceUpdate.notes = `Holiday: ${holiday.name}`;
    } else if (logType === "check_in") {
      attendanceUpdate.checkIn = now;
      attendanceUpdate.status = now.getHours() >= 10 ? "late" : "present";
    } else {
      const existing = await Attendance.findOne({
        employee: person._id,
        date: today,
      });
      if (existing?.checkIn) {
        const effectiveCheckOut = await getEffectiveCheckOut(
          device.company,
          person._id,
          now,
        );
        attendanceUpdate.checkOut = effectiveCheckOut;
        workHours = (effectiveCheckOut - existing.checkIn) / 3600000;
        attendanceUpdate.workHours = workHours;
      }
    }

    attendance = await Attendance.findOneAndUpdate(
      { employee: person._id, date: today },
      { $set: attendanceUpdate },
      { upsert: true, new: true },
    );

    try {
      await notifyHR(
        person,
        logType,
        device.location.name,
        now,
        workHours,
        device.company,
      );
    } catch (err) {
      console.error("[Biometric] notifyHR error:", err.message);
    }
    try {
      const timeStr = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      if (logType === "check_in") {
        await sendPushToEmployee(person._id, {
          title: "Punch In Recorded",
          body: `Hi ${person.firstName}, you punched in at ${timeStr} at ${device.location.name}.`,
          tag: "attendance-checkin",
          url: "/dashboard",
        });
      } else {
        const hrs = workHours ? `${workHours.toFixed(1)} hrs` : "";
        await sendPushToEmployee(person._id, {
          title: "Punch Out Recorded",
          body: `Hi ${person.firstName}, you punched out at ${timeStr}${hrs ? ` · ${hrs} worked` : ""}.`,
          tag: "attendance-checkout",
          url: "/dashboard",
        });
      }
    } catch {}
  } else {
    // StudentAttendance.date is bucketed with toDateOnly (UTC-normalized),
    // same convention studentAttendanceController.js uses for manual marks
    // and reads — using the server-local-timezone `today` here instead
    // would misfile early-morning check-ins under the wrong calendar day
    // and make them invisible to the "today" filters on web/mobile.
    const studentDate = toDateOnly(now);
    const attendanceUpdate = {
      company: person.company,
      student: person._id,
      date: studentDate,
      markedBy: null,
    };
    if (logType === "check_in") {
      attendanceUpdate.checkIn = now;
      attendanceUpdate.status = "present";
      attendanceUpdate.verifyMode =
        method === "nfc" ? "card" : method === "face" ? "face" : "manual";
    } else {
      attendanceUpdate.checkOut = now;
    }

    attendance = await StudentAttendance.findOneAndUpdate(
      { student: person._id, date: studentDate },
      { $set: attendanceUpdate },
      { upsert: true, new: true },
    );

    try {
      await notifyGuardians(person, logType, device.location.name, now);
    } catch (err) {
      console.error("[Biometric] notifyGuardians error:", err.message);
    }
  }

  await BiometricLog.create({
    company: device.company,
    personType: effectiveType,
    personModel: personModelName(effectiveType),
    person: person._id,
    device: device._id,
    location: device.location._id,
    method,
    type: logType,
    nfcUid: method === "nfc" ? nfcUid : undefined,
    attendanceModel:
      effectiveType === "employee" ? "Attendance" : "StudentAttendance",
    attendance: attendance._id,
    timestamp: now,
  });

  device.lastSeenAt = now;
  await device.save();

  res.json({
    success: true,
    data: {
      person: personLabel,
      type: logType,
      timestamp: now,
      location: device.location.name,
      attendance,
    },
  });
});

const getDeviceEmployees = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const device = await BiometricDevice.findOne({
    deviceToken: token,
    isActive: true,
  });
  if (!device) {
    res.status(403);
    throw new Error("Invalid device token");
  }

  const employees = await Employee.find({
    company: device.company,
    status: { $nin: ["terminated", "exited"] },
  })
    .select("_id firstName lastName employeeId faceDescriptor")
    .sort({ firstName: 1 });

  const students = await Student.find({
    company: device.company,
    status: { $ne: "inactive" },
  })
    .select("_id firstName lastName studentId faceDescriptor")
    .sort({ firstName: 1 });

  const data = [
    ...employees.map((e) => ({
      _id: e._id,
      personType: "employee",
      firstName: e.firstName,
      lastName: e.lastName,
      code: e.employeeId,
      hasFace:
        Array.isArray(e.faceDescriptor) && e.faceDescriptor.length === 128,
    })),
    ...students.map((s) => ({
      _id: s._id,
      personType: "student",
      firstName: s.firstName,
      lastName: s.lastName,
      code: s.studentId,
      hasFace:
        Array.isArray(s.faceDescriptor) && s.faceDescriptor.length === 128,
    })),
  ];

  res.json({ success: true, data });
});

const enrollFaceFromDevice = asyncHandler(async (req, res) => {
  const { deviceToken, personType, personId, descriptor } = req.body;

  const device = await BiometricDevice.findOne({ deviceToken, isActive: true });
  if (!device) {
    res.status(403);
    throw new Error("Invalid device token");
  }

  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    res.status(400);
    throw new Error("descriptor must be an array of 128 numbers");
  }

  const person = await findPerson(personType, personId, device.company);
  if (!person) {
    res.status(404);
    throw new Error("Employee/student not found");
  }

  person.faceDescriptor = descriptor;
  await person.save();

  res.json({
    success: true,
    message: `Face enrolled for ${person.firstName} ${person.lastName}`,
    data: {
      personId: person._id,
      personType,
      name: `${person.firstName} ${person.lastName}`,
    },
  });
});

// ─── Logs ───────────────────────────────────────────────────────────────────

const getLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query, 50, 5000);
  const { locationId, deviceId, personType, personId, date, month, year } =
    req.query;

  const filter = { company: req.user.company };
  if (locationId) filter.location = locationId;
  if (deviceId) filter.device = deviceId;
  if (personType) filter.personType = personType;
  if (personId) filter.person = personId;
  if (date) {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      filter.timestamp = { $gte: d, $lte: end };
    }
  } else if (month && year) {
    const m = parseInt(month),
      y = parseInt(year);
    if (!isNaN(m) && !isNaN(y)) {
      filter.timestamp = {
        $gte: new Date(y, m - 1, 1),
        $lt: new Date(y, m, 1),
      };
    }
  }

  const total = await BiometricLog.countDocuments(filter);
  const logs = await BiometricLog.find(filter)
    .populate("person", "firstName lastName employeeId studentId")
    .populate("device", "name")
    .populate("location", "name address")
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: logs,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

// ─── Sync / enrollment ──────────────────────────────────────────────────────

const setDeviceSerial = asyncHandler(async (req, res) => {
  const { serialNumber } = req.body;
  if (!serialNumber) {
    res.status(400);
    throw new Error("serialNumber is required");
  }
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }

  const conflict = await BiometricDevice.findOne({
    serialNumber,
    _id: { $ne: device._id },
  });
  if (conflict) {
    res.status(400);
    throw new Error("Serial number already registered to another device");
  }
  device.serialNumber = serialNumber.trim().toUpperCase();
  await device.save();
  res.json({ success: true, data: device });
});

const syncPersonToDevice = asyncHandler(async (req, res) => {
  const { personType, personId, rfidCard } = req.body;
  if (!personType || !personId) {
    res.status(400);
    throw new Error("personType and personId are required");
  }

  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  if (!device.serialNumber) {
    res.status(400);
    throw new Error("Device has no serial number set — register it first");
  }

  const person = await findPerson(personType, personId, req.user.company);
  if (!person) {
    res.status(404);
    throw new Error("Employee/student not found");
  }
  if (!person.biometricUserId) {
    res.status(400);
    throw new Error("No Biometric User ID set — set it first");
  }

  if (rfidCard !== undefined) {
    const trimmed = rfidCard.trim();
    if (trimmed) {
      const conflict = await isRfidCardTaken(
        req.user.company,
        trimmed,
        personType,
        person._id,
      );
      if (conflict) {
        res.status(400);
        throw new Error(
          `RFID card already assigned to ${conflict.firstName} ${conflict.lastName}`,
        );
      }
    }
    person.rfidCard = trimmed;
    await person.save();
  }

  await BiometricCommand.deleteMany({
    device: device._id,
    personType,
    person: person._id,
    type: "SET_USER",
    status: "pending",
  });

  const cmdId = await nextCmdId(device._id);
  const cmd = await BiometricCommand.create({
    device: device._id,
    company: device.company,
    cmdId,
    command: buildSetUserCmd(person),
    type: "SET_USER",
    personType,
    personModel: personModelName(personType),
    person: person._id,
  });

  res.json({
    success: true,
    message: "Command queued — device will receive it on next poll",
    data: { cmdId: cmd.cmdId, person: person.biometricUserId },
  });
});

const syncAllToDevice = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  if (!device.serialNumber) {
    res.status(400);
    throw new Error("Device has no serial number set");
  }

  const employees = await Employee.find({
    company: req.user.company,
    biometricUserId: { $exists: true, $ne: "" },
    status: { $nin: ["terminated", "exited"] },
  });
  const students = await Student.find({
    company: req.user.company,
    biometricUserId: { $exists: true, $ne: "" },
    status: { $ne: "inactive" },
  });

  await BiometricCommand.deleteMany({
    device: device._id,
    type: "SET_USER",
    status: "pending",
  });

  let baseId = await nextCmdId(device._id);
  const cmds = [
    ...employees.map((p, i) => ({
      device: device._id,
      company: device.company,
      cmdId: baseId + i,
      command: buildSetUserCmd(p),
      type: "SET_USER",
      personType: "employee",
      personModel: "Employee",
      person: p._id,
    })),
    ...students.map((p, i) => ({
      device: device._id,
      company: device.company,
      cmdId: baseId + employees.length + i,
      command: buildSetUserCmd(p),
      type: "SET_USER",
      personType: "student",
      personModel: "Student",
      person: p._id,
    })),
  ];

  if (cmds.length) await BiometricCommand.insertMany(cmds);

  res.json({
    success: true,
    message: `${cmds.length} person(s) queued for sync`,
    data: { queued: cmds.length },
  });
});

const removePersonFromDevice = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }

  const { personType, personId } = req.params;
  const person = await findPerson(personType, personId, req.user.company);
  if (!person || !person.biometricUserId) {
    res.status(404);
    throw new Error("Employee/student not found or has no biometric ID");
  }

  const cmdId = await nextCmdId(device._id);
  await BiometricCommand.create({
    device: device._id,
    company: device.company,
    cmdId,
    command: `DATA DELETE USERINFO PIN=${person.biometricUserId}`,
    type: "DELETE_USER",
    personType,
    personModel: personModelName(personType),
    person: person._id,
  });

  res.json({ success: true, message: "Delete command queued" });
});

const getDeviceCommands = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }

  const cmds = await BiometricCommand.find({ device: device._id })
    .populate(
      "person",
      "firstName lastName employeeId studentId biometricUserId",
    )
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ success: true, data: cmds });
});

const saveRfidCard = asyncHandler(async (req, res) => {
  const { rfidCard } = req.body;
  const { personType, id } = req.params;
  if (!rfidCard) {
    res.status(400);
    throw new Error("rfidCard is required");
  }

  const person = await findPerson(personType, id, req.user.company);
  if (!person) {
    res.status(404);
    throw new Error("Employee/student not found");
  }

  const trimmed = rfidCard.trim();
  const conflict = await isRfidCardTaken(
    req.user.company,
    trimmed,
    personType,
    person._id,
  );
  if (conflict) {
    res.status(400);
    throw new Error(
      `RFID card already assigned to ${conflict.firstName} ${conflict.lastName}`,
    );
  }

  person.rfidCard = trimmed;
  await person.save();

  res.json({
    success: true,
    message: "RFID card saved",
    data: { rfidCard: person.rfidCard },
  });
});

const saveFaceDescriptor = asyncHandler(async (req, res) => {
  const { descriptor } = req.body;
  const { personType, id } = req.params;
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    res.status(400);
    throw new Error("descriptor must be an array of 128 numbers");
  }

  const person = await findPerson(personType, id, req.user.company);
  if (!person) {
    res.status(404);
    throw new Error("Employee/student not found");
  }

  person.faceDescriptor = descriptor;
  await person.save();

  res.json({ success: true, message: "Face descriptor saved" });
});

const getFaceDescriptors = asyncHandler(async (req, res) => {
  const employees = await Employee.find({
    company: req.user.company,
    faceDescriptor: { $exists: true, $not: { $size: 0 } },
    status: { $nin: ["terminated", "exited"] },
  }).select("_id firstName lastName employeeId faceDescriptor");

  const students = await Student.find({
    company: req.user.company,
    faceDescriptor: { $exists: true, $not: { $size: 0 } },
    status: { $ne: "inactive" },
  }).select("_id firstName lastName studentId faceDescriptor");

  const data = [
    ...employees.map((e) => ({
      personType: "employee",
      personId: e._id,
      name: `${e.firstName} ${e.lastName}`,
      code: e.employeeId,
      descriptor: e.faceDescriptor,
    })),
    ...students.map((s) => ({
      personType: "student",
      personId: s._id,
      name: `${s.firstName} ${s.lastName}`,
      code: s.studentId,
      descriptor: s.faceDescriptor,
    })),
  ];

  res.json({ success: true, data });
});

const faceAttendance = asyncHandler(async (req, res) => {
  const { descriptor, deviceToken } = req.body;
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    res.status(400);
    throw new Error("Invalid face descriptor");
  }

  const device = deviceToken
    ? await BiometricDevice.findOne({ deviceToken, isActive: true }).populate(
        "location",
      )
    : null;
  if (deviceToken && !device) {
    res.status(404);
    throw new Error("Device not found");
  }

  const companyFilter = device ? { company: device.company } : {};
  const employees = await Employee.find({
    ...companyFilter,
    faceDescriptor: { $exists: true, $not: { $size: 0 } },
    status: { $nin: ["terminated", "exited"] },
  })
    .select("_id firstName lastName employeeId phone faceDescriptor company")
    .lean();
  const students = await Student.find({
    ...companyFilter,
    faceDescriptor: { $exists: true, $not: { $size: 0 } },
    status: { $ne: "inactive" },
  })
    .select("_id firstName lastName studentId guardians faceDescriptor company")
    .lean();

  const candidates = [
    ...employees.map((e) => ({ ...e, personType: "employee" })),
    ...students.map((s) => ({ ...s, personType: "student" })),
  ];

  const THRESHOLD = 0.5;
  let bestMatch = null;
  let bestDist = Infinity;

  for (const cand of candidates) {
    const stored = cand.faceDescriptor;
    let dist = 0;
    for (let i = 0; i < 128; i++) {
      const d = (descriptor[i] || 0) - (stored[i] || 0);
      dist += d * d;
    }
    dist = Math.sqrt(dist);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = cand;
    }
  }

  if (!bestMatch || bestDist > THRESHOLD) {
    res.status(404);
    throw new Error(
      `No matching person found (best dist: ${bestDist.toFixed(3)})`,
    );
  }

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const lastTodayLog = await BiometricLog.findOne({
    personType: bestMatch.personType,
    person: bestMatch._id,
    timestamp: { $gte: today },
  }).sort({ timestamp: -1 });

  const personLabel = {
    name: `${bestMatch.firstName} ${bestMatch.lastName}`,
    code:
      bestMatch.personType === "employee"
        ? bestMatch.employeeId
        : bestMatch.studentId,
  };

  if (lastTodayLog?.type === "check_out") {
    return res.json({
      success: true,
      locked: true,
      data: {
        person: personLabel,
        type: "check_out",
        message: "Already checked out for today",
        checkedOutAt: lastTodayLog.timestamp,
      },
    });
  }

  const logType = lastTodayLog?.type === "check_in" ? "check_out" : "check_in";

  if (logType === "check_in" && lastTodayLog?.type === "check_in") {
    return res.json({
      success: true,
      locked: true,
      data: {
        person: personLabel,
        type: "check_in",
        message: "Already checked in, awaiting check-out",
        checkedInAt: lastTodayLog.timestamp,
      },
    });
  }

  let attendance;
  let workHours;

  if (bestMatch.personType === "employee") {
    const attendanceUpdate = {
      employee: bestMatch._id,
      date: today,
      markedBy: null,
    };
    if (logType === "check_in") {
      attendanceUpdate.checkIn = now;
      attendanceUpdate.status = now.getHours() >= 10 ? "late" : "present";
    } else {
      const existing = await Attendance.findOne({
        employee: bestMatch._id,
        date: today,
      });
      if (existing?.checkIn) {
        const effectiveCheckOut = await getEffectiveCheckOut(
          bestMatch.company,
          bestMatch._id,
          now,
        );
        attendanceUpdate.checkOut = effectiveCheckOut;
        workHours = (effectiveCheckOut - existing.checkIn) / 3600000;
        attendanceUpdate.workHours = workHours;
      }
    }
    attendance = await Attendance.findOneAndUpdate(
      { employee: bestMatch._id, date: today },
      { $set: attendanceUpdate },
      { upsert: true, new: true },
    );

    try {
      const timeStr = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      if (logType === "check_in") {
        await sendPushToEmployee(bestMatch._id, {
          title: "Punch In Recorded",
          body: `Hi ${bestMatch.firstName}, you punched in at ${timeStr}.`,
          tag: "attendance-checkin",
          url: "/dashboard",
        });
      } else {
        const hrs = workHours ? `${workHours.toFixed(1)} hrs` : "";
        await sendPushToEmployee(bestMatch._id, {
          title: "Punch Out Recorded",
          body: `Hi ${bestMatch.firstName}, you punched out at ${timeStr}${hrs ? ` · ${hrs} worked` : ""}.`,
          tag: "attendance-checkout",
          url: "/dashboard",
        });
      }
      await notifyHR(
        bestMatch,
        logType,
        device?.location?.name || "Office",
        now,
        workHours,
        bestMatch.company,
      );
    } catch (err) {
      console.error("[Biometric] faceAttendance notify error:", err.message);
    }
  } else {
    const studentDate = toDateOnly(now);
    const attendanceUpdate = {
      company: bestMatch.company,
      student: bestMatch._id,
      date: studentDate,
      markedBy: null,
      verifyMode: "face",
    };
    if (logType === "check_in") {
      attendanceUpdate.checkIn = now;
      attendanceUpdate.status = "present";
    } else {
      attendanceUpdate.checkOut = now;
    }
    attendance = await StudentAttendance.findOneAndUpdate(
      { student: bestMatch._id, date: studentDate },
      { $set: attendanceUpdate },
      { upsert: true, new: true },
    );

    try {
      await notifyGuardians(
        bestMatch,
        logType,
        device?.location?.name || "Office",
        now,
      );
    } catch (err) {
      console.error(
        "[Biometric] faceAttendance notifyGuardians error:",
        err.message,
      );
    }
  }

  if (device) {
    await BiometricLog.create({
      company: bestMatch.company,
      personType: bestMatch.personType,
      personModel: personModelName(bestMatch.personType),
      person: bestMatch._id,
      device: device._id,
      location: device.location,
      method: "face",
      type: logType,
      attendanceModel:
        bestMatch.personType === "employee"
          ? "Attendance"
          : "StudentAttendance",
      attendance: attendance._id,
      timestamp: now,
    });
  }

  res.json({
    success: true,
    data: {
      person: personLabel,
      type: logType,
      confidence: parseFloat(((1 - bestDist / THRESHOLD) * 100).toFixed(1)),
      timestamp: now,
      location: device?.location?.name,
    },
  });
});

const triggerFaceEnroll = asyncHandler(async (req, res) => {
  const { personType, personId } = req.body;
  if (!personType || !personId) {
    res.status(400);
    throw new Error("personType and personId are required");
  }

  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  if (!device.serialNumber) {
    res.status(400);
    throw new Error(
      "Device serial number not registered — pair the ADMS device first",
    );
  }

  const person = await findPerson(personType, personId, req.user.company);
  if (!person || !person.biometricUserId) {
    res.status(400);
    throw new Error("Person not found or has no biometric user ID");
  }

  const cmdId = await nextCmdId(device._id);

  await BiometricCommand.create({
    device: device._id,
    company: device.company,
    cmdId,
    // ENROLL_BIO Type=9 = face on ZKTeco ZLM60 series (ESSL MB20 firmware ZLM60-NF28VA)
    command: `ENROLL_BIO PIN=${person.biometricUserId}\tType=9\tNo=0\tOverWrite=1`,
    type: "ENROLL_FACE",
    personType,
    personModel: personModelName(personType),
    person: person._id,
  });

  res.json({
    success: true,
    message: `Face enrollment queued for ${person.firstName} ${person.lastName}. Ask them to stand in front of the device.`,
    data: { cmdId },
  });
});

const pushFaceTemplateToDevice = asyncHandler(async (req, res) => {
  const { personType, personId } = req.body;
  if (!personType || !personId) {
    res.status(400);
    throw new Error("personType and personId are required");
  }

  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  if (!device.serialNumber) {
    res.status(400);
    throw new Error("Device serial number not registered");
  }

  const person = await findPerson(personType, personId, req.user.company);
  if (!person || !person.biometricUserId) {
    res.status(400);
    throw new Error("Person not found or has no biometric user ID");
  }
  if (!person.deviceFaceTemplate) {
    res.status(400);
    throw new Error(
      "No face template stored for this person. Enroll their face on any device first.",
    );
  }

  const cmdId = await nextCmdId(device._id);
  const templateStr = Buffer.from(person.deviceFaceTemplate, "hex").toString();

  await BiometricCommand.create({
    device: device._id,
    company: device.company,
    cmdId,
    command: templateStr,
    type: "PUSH_FACE",
    personType,
    personModel: personModelName(personType),
    person: person._id,
  });

  res.json({
    success: true,
    message: `Face template push queued for ${person.firstName} ${person.lastName}.`,
    data: { cmdId },
  });
});

const triggerFingerprintEnroll = asyncHandler(async (req, res) => {
  const { personType, personId, fingerIndex = 0 } = req.body;
  if (!personType || !personId) {
    res.status(400);
    throw new Error("personType and personId are required");
  }

  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  if (!device.serialNumber) {
    res.status(400);
    throw new Error("Device serial number not registered");
  }

  const person = await findPerson(personType, personId, req.user.company);
  if (!person || !person.biometricUserId) {
    res.status(400);
    throw new Error("Person not found or has no biometric user ID");
  }

  const cmdId = await nextCmdId(device._id);

  await BiometricCommand.create({
    device: device._id,
    company: device.company,
    cmdId,
    command: `ENROLL_FP PIN=${person.biometricUserId}\tNo=${fingerIndex}\tOverWrite=1\tDuress=0`,
    type: "SET_USER",
    personType,
    personModel: personModelName(personType),
    person: person._id,
  });

  res.json({
    success: true,
    message: `Fingerprint enrollment queued for ${person.firstName} ${person.lastName}. Ask them to place their finger on the device when it beeps.`,
    data: { cmdId, fingerIndex },
  });
});

// ─── Biometric user ID assignment (shared PIN space) ───────────────────────

const assignBiometricUserId = asyncHandler(async (req, res) => {
  const { personType, id } = req.params;
  const { biometricUserId } = req.body;
  if (!biometricUserId) {
    res.status(400);
    throw new Error("biometricUserId is required");
  }

  const person = await findPerson(personType, id, req.user.company);
  if (!person) {
    res.status(404);
    throw new Error("Employee/student not found");
  }

  const taken = await isBiometricIdTaken(
    req.user.company,
    biometricUserId.trim(),
    personType,
    person._id,
  );
  if (taken) {
    res.status(400);
    throw new Error(
      "This Biometric User ID is already assigned to someone else",
    );
  }

  person.biometricUserId = biometricUserId.trim();
  await person.save();

  res.json({
    success: true,
    data: { biometricUserId: person.biometricUserId },
  });
});

module.exports = {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  regenerateDeviceToken,
  assignNfcCard,
  removeNfcCard,
  registerDevice,
  getDeviceInfo,
  recordBiometric,
  getLogs,
  setDeviceSerial,
  syncPersonToDevice,
  syncAllToDevice,
  removePersonFromDevice,
  getDeviceCommands,
  saveRfidCard,
  saveFaceDescriptor,
  getFaceDescriptors,
  faceAttendance,
  triggerFingerprintEnroll,
  getDeviceEmployees,
  enrollFaceFromDevice,
  triggerFaceEnroll,
  pushFaceTemplateToDevice,
  assignBiometricUserId,
};
