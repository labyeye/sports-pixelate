const express = require("express");
const router = express.Router();
const Employee = require("../models/Employee");
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const StudentAttendance = require("../models/StudentAttendance");
const BiometricDevice = require("../models/BiometricDevice");
const BiometricCommand = require("../models/BiometricCommand");
const Shift = require("../models/Shift");
const DeductionRule = require("../models/DeductionRule");
const { getEffectiveCheckOut } = require("../utils/shiftUtils");
const { handleLateAllowance } = require("../controllers/attendanceController");
const {
  sendCheckIn,
  sendCheckInHR,
  sendCheckOut,
  sendCheckOutHR,
  sendStudentCheckIn,
  sendStudentCheckOut,
} = require("../services/whatsappService");
const User = require("../models/User");

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Mirrors attendanceController's resolveStatus: only auto-promotes present → late,
// based on the employee's shift start time and the company's configured grace period.
async function resolveEmployeeStatus(employee, checkIn) {
  if (!checkIn) return "present";
  const shiftId = employee.shift;
  const shift =
    employee.isCustomShift && employee.customShift?.startTime
      ? employee.customShift
      : shiftId
        ? await Shift.findById(shiftId).select("startTime")
        : null;
  if (!shift?.startTime) return "present";

  const [h, m] = shift.startTime.split(":").map(Number);
  const shiftStartMins = h * 60 + m;
  const ist = new Date(new Date(checkIn).getTime() + IST_OFFSET_MS);
  const checkInMins = ist.getUTCHours() * 60 + ist.getUTCMinutes();

  const rule = await DeductionRule.findOne({
    company: employee.company,
  }).select("lateThresholdMinutes");
  const graceMinutes = rule?.lateThresholdMinutes ?? 15;

  return checkInMins > shiftStartMins + graceMinutes ? "late" : "present";
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function serverTimeStr() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function parseAttLog(raw) {
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const cols = line.split("\t");
      return {
        userId: cols[0]?.trim(),
        datetime: cols[1]?.trim(),
        punchState: parseInt(cols[2]?.trim() || "0", 10),
        verifyType: parseInt(cols[3]?.trim() || "1", 10),
      };
    })
    .filter((r) => r.userId && r.datetime);
}

function mapVerifyMode(verifyType) {
  if (verifyType === 1) return "fingerprint";
  if (verifyType === 4 || verifyType === 6) return "card";
  if (verifyType === 7 || verifyType === 15) return "face";
  if (verifyType === 0 || verifyType === 3) return "password";
  return "fingerprint";
}

async function notifyEmployeeCheckIn(employee, locationName, time, companyId) {
  try {
    const hrUsers = await User.find({
      company: companyId,
      role: { $in: ["super_admin", "hr_manager"] },
    }).select("phone name");

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
            empName: `${employee.firstName} ${employee.lastName}`,
            empId: employee.employeeId,
            locationName,
            time,
          },
          companyId,
        );
      }
    }
  } catch (err) {
    console.error("[ADMS] notifyEmployeeCheckIn error:", err.message);
  }
}

async function notifyEmployeeCheckOut(
  employee,
  locationName,
  time,
  workHours,
  companyId,
) {
  try {
    const hrUsers = await User.find({
      company: companyId,
      role: { $in: ["super_admin", "hr_manager"] },
    }).select("phone name");

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
            empName: `${employee.firstName} ${employee.lastName}`,
            empId: employee.employeeId,
            locationName,
            time,
            workHours,
          },
          companyId,
        );
      }
    }
  } catch (err) {
    console.error("[ADMS] notifyEmployeeCheckOut error:", err.message);
  }
}

async function notifyGuardians(student, sendFn, locationName, time) {
  try {
    const studentName = `${student.firstName} ${student.lastName}`;
    // Only the one guardian opted in via receivesWhatsapp gets notified —
    // otherwise every listed guardian (father, mother, etc.) would be messaged.
    const guardian = (student.guardians || []).find(
      (g) => g.receivesWhatsapp && g.phone,
    );
    if (!guardian) return;
    await sendFn(
      guardian.phone,
      {
        guardianName: guardian.name,
        studentName,
        locationName,
        time,
      },
      student.company,
    );
  } catch (err) {
    console.error("[ADMS] notifyGuardians error:", err.message);
  }
}

async function processEmployeePunch(
  employee,
  punchTime,
  verifyMode,
  loc,
  companyId,
) {
  const dayStart = new Date(
    Date.UTC(
      punchTime.getUTCFullYear(),
      punchTime.getUTCMonth(),
      punchTime.getUTCDate(),
    ),
  );
  const existing = await Attendance.findOne({
    employee: employee._id,
    date: dayStart,
  });

  if (!existing) {
    const status = await resolveEmployeeStatus(employee, punchTime);
    let approvalPending = false;
    if (status === "late") {
      approvalPending = await handleLateAllowance(
        employee._id,
        employee.company,
        dayStart,
        punchTime,
      );
    }
    await Attendance.create({
      employee: employee._id,
      date: dayStart,
      status,
      checkIn: punchTime,
      approvalPending,
      verifyMode,
    });
    console.log(
      `[ADMS] Created attendance checkIn=${punchTime.toISOString()} status=${status} verifyMode=${verifyMode} for ${employee.firstName}`,
    );
    await notifyEmployeeCheckIn(employee, loc, punchTime, companyId);
    return;
  }

  if (existing.checkOut) {
    console.log(
      `[ADMS] Attendance locked (already checked out) for ${employee.firstName} ${employee.lastName}`,
    );
    return;
  }

  const upd = {};
  let logType = null;

  if (!existing.checkIn || punchTime < existing.checkIn) {
    upd.checkIn = punchTime;
    upd.verifyMode = verifyMode;
    upd.status = await resolveEmployeeStatus(employee, punchTime);
    if (upd.status === "late") {
      upd.approvalPending = await handleLateAllowance(
        employee._id,
        employee.company,
        dayStart,
        punchTime,
      );
    }
    logType = "check_in";
  } else if (punchTime > existing.checkIn) {
    upd.checkOut = await getEffectiveCheckOut(
      companyId,
      employee._id,
      punchTime,
    );
    logType = "check_out";
  }

  if (Object.keys(upd).length) {
    const ci = upd.checkIn || existing.checkIn;
    const co = upd.checkOut;
    if (ci && co && co > ci) {
      upd.workHours = parseFloat(((co - ci) / 3_600_000).toFixed(2));
    }
    if (!upd.status) upd.status = existing.status || "present";
    await Attendance.updateOne({ _id: existing._id }, { $set: upd });
    if (logType === "check_in") {
      await notifyEmployeeCheckIn(employee, loc, upd.checkIn, companyId);
    } else if (logType === "check_out") {
      await notifyEmployeeCheckOut(
        employee,
        loc,
        upd.checkOut,
        upd.workHours,
        companyId,
      );
    }
  }
}

async function processStudentPunch(student, punchTime, verifyMode, loc) {
  const dayStart = new Date(
    Date.UTC(
      punchTime.getUTCFullYear(),
      punchTime.getUTCMonth(),
      punchTime.getUTCDate(),
    ),
  );
  const existing = await StudentAttendance.findOne({
    student: student._id,
    date: dayStart,
  });

  if (!existing) {
    await StudentAttendance.create({
      company: student.company,
      student: student._id,
      date: dayStart,
      status: "present",
      checkIn: punchTime,
      verifyMode,
    });
    console.log(
      `[ADMS] Created student attendance checkIn=${punchTime.toISOString()} for ${student.firstName}`,
    );
    await notifyGuardians(student, sendStudentCheckIn, loc, punchTime);
    return;
  }

  if (existing.checkOut) {
    console.log(
      `[ADMS] Student attendance locked (already checked out) for ${student.firstName} ${student.lastName}`,
    );
    return;
  }

  if (!existing.checkIn || punchTime < existing.checkIn) {
    await StudentAttendance.updateOne(
      { _id: existing._id },
      { $set: { checkIn: punchTime, verifyMode, status: "present" } },
    );
    await notifyGuardians(student, sendStudentCheckIn, loc, punchTime);
  } else if (punchTime > existing.checkIn) {
    await StudentAttendance.updateOne(
      { _id: existing._id },
      { $set: { checkOut: punchTime, verifyMode } },
    );
    await notifyGuardians(student, sendStudentCheckOut, loc, punchTime);
  }
}

async function processLog(
  { userId, datetime, verifyType },
  companyId,
  locationName,
) {
  const punchTime = new Date(datetime.replace(" ", "T") + "+05:30");
  if (isNaN(punchTime.getTime())) {
    console.log(`[ADMS] Invalid datetime for userId=${userId}: "${datetime}"`);
    return;
  }

  const verifyMode = mapVerifyMode(verifyType);
  const loc = locationName || "Office";

  const employee = await Employee.findOne({
    biometricUserId: userId,
    ...(companyId ? { company: companyId } : {}),
    status: { $ne: "terminated" },
  });
  if (employee) {
    console.log(
      `[ADMS] Punch: employee=${employee.firstName} ${employee.lastName} uid=${userId} time=${punchTime.toISOString()}`,
    );
    await processEmployeePunch(employee, punchTime, verifyMode, loc, companyId);
    return;
  }

  const student = await Student.findOne({
    biometricUserId: userId,
    ...(companyId ? { company: companyId } : {}),
    status: { $ne: "inactive" },
  });
  if (student) {
    console.log(
      `[ADMS] Punch: student=${student.firstName} ${student.lastName} uid=${userId} time=${punchTime.toISOString()}`,
    );
    await processStudentPunch(student, punchTime, verifyMode, loc);
    return;
  }

  console.log(
    `[ADMS] No employee or student found for biometricUserId=${userId} company=${companyId}`,
  );
}

async function resolveDevice(sn) {
  if (!sn) return null;
  // Find by SN regardless of isActive — if the device is polling, it IS active.
  // Auto-heal isActive so admin routes also see it correctly.
  return BiometricDevice.findOneAndUpdate(
    { serialNumber: sn },
    { $set: { isActive: true, lastSeenAt: new Date() } },
    { new: true },
  );
}

router.get(["/cdata", "/cdata.aspx"], async (req, res) => {
  const { SN } = req.query;
  res.set("Content-Type", "text/plain");

  let attlogStamp = "None";
  if (SN) {
    const device = await BiometricDevice.findOneAndUpdate(
      { serialNumber: SN },
      { lastSeenAt: new Date() },
      { new: true },
    ).catch(() => null);
    if (device?.attlogStamp) attlogStamp = device.attlogStamp;
  }

  res.send(
    [
      `GET OPTION FROM: ${SN || "DEVICE"}`,
      `ATTLOGStamp=${attlogStamp}`,
      `OPERLOGStamp=9999`,
      `ATTPHOTOStamp=None`,
      `ErrorDelay=30`,
      `Delay=10`,
      `TransTimes=00:00;23:59`,
      `TransInterval=1`,
      `TransFlag=111100000001000`,
      `Realtime=1`,
      `Encrypt=0`,
      `ServerVer=2.4.1`,
      `PushProtVer=2.4.1`,
      `PushOptionsFlag=1`,
      `datetime=${serverTimeStr()}`,
      ``,
    ].join("\n"),
  );
});

router.post(
  ["/cdata", "/cdata.aspx"],
  express.text({ type: "*/*" }),
  async (req, res) => {
    const { SN, table } = req.query;
    res.set("Content-Type", "text/plain");

    const body = req.body;
    if (!body || typeof body !== "string") return res.send("OK");

    // Handle face/finger bio template upload from device after ENROLL_BIO command
    if (table === "BIODATA") {
      try {
        const device = await resolveDevice(SN);
        console.log(
          `[ADMS] BIODATA from SN=${SN} body="${body.slice(0, 200)}"`,
        );

        if (device) {
          const pinMatch = body.match(/\bPIN=(\S+)/);
          const typeMatch = body.match(/\bType=(\d+)/);
          const pin = pinMatch ? pinMatch[1] : null;
          const biotype = typeMatch ? parseInt(typeMatch[1], 10) : null;

          if (pin && biotype === 9) {
            // Type=9 = face template on ZKTeco ZLM60
            let person = await Employee.findOne({
              biometricUserId: pin,
              company: device.company,
            });
            let PersonModel = Employee;
            if (!person) {
              person = await Student.findOne({
                biometricUserId: pin,
                company: device.company,
              });
              PersonModel = Student;
            }
            if (person) {
              person.deviceFaceTemplate = Buffer.from(body).toString("hex");
              person.deviceFaceEnrolledAt = new Date();
              await person.save();
              console.log(
                `[ADMS] BIODATA: stored face template for ${person.firstName} ${person.lastName} (PIN=${pin})`,
              );
            } else {
              console.warn(
                `[ADMS] BIODATA: no employee/student found for PIN=${pin} company=${device.company}`,
              );
            }
          }
        }
      } catch (err) {
        console.error("[ADMS] BIODATA handler error:", err.message);
      }
      return res.send("OK");
    }

    if (table !== "ATTLOG") return res.send("OK");

    const stamp = parseInt(req.query.Stamp || "0", 10) || 0;

    try {
      const device = await resolveDevice(SN);
      const companyId = device?.company || null;

      console.log(`[ADMS] ATTLOG from SN=${SN} stamp=${stamp}`);
      const logs = parseAttLog(body);

      let devLocationName = "Office";
      if (device?.location) {
        const BiometricLocation = require("../models/BiometricLocation");
        const loc = await BiometricLocation.findById(device.location).select(
          "name",
        );
        if (loc?.name) devLocationName = loc.name;
      }

      await Promise.allSettled(
        logs.map((log) => processLog(log, companyId, devLocationName)),
      );

      if (device && stamp > (device.attlogStamp || 0)) {
        device.attlogStamp = stamp;
        device.lastSeenAt = new Date();
        await device.save();
      }

      res.send(`OK: ${stamp}`);
    } catch (err) {
      console.error("[ADMS] cdata POST error:", err.message);
      res.send("OK");
    }
  },
);

router.get(["/getrequest", "/getrequest.aspx"], async (req, res) => {
  const { SN } = req.query;
  res.set("Content-Type", "text/plain");

  try {
    if (!SN) {
      console.warn("[ADMS] getrequest: no SN in query");
      return res.send("OK");
    }

    const device = await resolveDevice(SN);
    if (!device) {
      console.warn(`[ADMS] getrequest: unknown device SN=${SN}`);
      return res.send("OK");
    }

    const cmd = await BiometricCommand.findOneAndUpdate(
      { device: device._id, status: "pending" },
      { $set: { status: "sent", sentAt: new Date() } },
      { new: true, sort: { createdAt: 1 } },
    );

    if (!cmd) return res.send("OK");

    console.log(
      `[ADMS] getrequest: SN=${SN} → C:${cmd.cmdId}:${cmd.command.replace(/\t/g, "\\t")}`,
    );
    res.send(`C:${cmd.cmdId}:${cmd.command}\n`);
  } catch (err) {
    console.error("[ADMS] getrequest error:", err.message);
    res.send("OK");
  }
});

router.post(
  ["/devicecmd", "/devicecmd.aspx"],
  express.text({ type: "*/*" }),
  async (req, res) => {
    const { SN, ID } = req.query;
    res.set("Content-Type", "text/plain");

    try {
      const body = req.body || "";
      const bodyIdMatch = body.match(/\bID=(\d+)/);
      const cmdId = ID || (bodyIdMatch ? bodyIdMatch[1] : null);

      console.log(
        `[ADMS] devicecmd SN=${SN} ID=${cmdId} body="${body.trim()}"`,
      );

      if (cmdId) {
        const device = await resolveDevice(SN);
        if (device) {
          const returnMatch = body.match(/Return=(\d+)/);
          const returnCode = returnMatch ? returnMatch[1] : "0";

          await BiometricCommand.findOneAndUpdate(
            { device: device._id, cmdId: Number(cmdId) },
            {
              $set: {
                status: returnCode === "0" ? "done" : "failed",
                returnCode,
                doneAt: new Date(),
              },
            },
          );
        }
      }
    } catch (err) {
      console.error("[ADMS] devicecmd error:", err.message);
    }

    res.send("OK");
  },
);

module.exports = router;
