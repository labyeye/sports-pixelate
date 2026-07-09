const asyncHandler = require("express-async-handler");
const AttendanceCorrectionRequest = require("../models/AttendanceCorrectionRequest");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const Shift = require("../models/Shift");

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

async function resolveStatus(employeeId, checkIn, requestedStatus) {
  if (!checkIn || requestedStatus !== "present") return requestedStatus;
  const emp = await Employee.findById(employeeId).select("shift");
  if (!emp?.shift) return requestedStatus;
  const shift = await Shift.findById(emp.shift).select("startTime");
  if (!shift?.startTime) return requestedStatus;

  const [shiftH, shiftM] = shift.startTime.split(":").map(Number);
  const shiftStartMinutes = shiftH * 60 + shiftM;
  const checkInIST = new Date(new Date(checkIn).getTime() + IST_OFFSET_MS);
  const checkInMinutes = checkInIST.getUTCHours() * 60 + checkInIST.getUTCMinutes();

  return checkInMinutes > shiftStartMinutes + 15 ? "late" : requestedStatus;
}

exports.createRequest = asyncHandler(async (req, res) => {
  const { date, type, checkIn, checkOut, reason } = req.body;
  if (!date || !type || !reason) {
    res.status(400);
    throw new Error("date, type, and reason are required");
  }

  const emp = await Employee.findOne({ user: req.user._id });
  if (!emp) {
    res.status(404);
    throw new Error("Employee record not found");
  }

  const reqDate = new Date(date);
  reqDate.setHours(0, 0, 0, 0);

  // Check if there is already a pending request for this date
  const existing = await AttendanceCorrectionRequest.findOne({
    employee: emp._id,
    date: reqDate,
    status: "pending",
  });
  if (existing) {
    res.status(400);
    throw new Error("You already have a pending correction request for this date");
  }

  const attendance = await Attendance.findOne({ employee: emp._id, date: reqDate });

  const correction = await AttendanceCorrectionRequest.create({
    company: req.user.company,
    employee: emp._id,
    attendance: attendance?._id,
    date: reqDate,
    type,
    checkIn: checkIn ? new Date(checkIn) : undefined,
    checkOut: checkOut ? new Date(checkOut) : undefined,
    reason,
  });

  res.status(201).json({ success: true, data: correction });
});

exports.getRequests = asyncHandler(async (req, res) => {
  const filter = { company: req.user.company };

  if (req.user.role === "employee") {
    const emp = await Employee.findOne({ user: req.user._id });
    if (!emp) return res.json({ success: true, data: [] });
    filter.employee = emp._id;
  } else if (req.query.employeeId) {
    filter.employee = req.query.employeeId;
  }

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const requests = await AttendanceCorrectionRequest.find(filter)
    .populate("employee", "firstName lastName employeeId designation")
    .sort({ date: -1 });

  res.json({ success: true, data: requests });
});

exports.approveRejectRequest = asyncHandler(async (req, res) => {
  const { status, rejectionReason } = req.body;
  if (!status || !["approved", "rejected"].includes(status)) {
    res.status(400);
    throw new Error("Status must be approved or rejected");
  }

  const request = await AttendanceCorrectionRequest.findOne({
    _id: req.params.id,
    company: req.user.company,
  });

  if (!request) {
    res.status(404);
    throw new Error("Correction request not found");
  }

  if (request.status !== "pending") {
    res.status(400);
    throw new Error("Request has already been processed");
  }

  request.status = status;
  request.approvedBy = req.user._id;
  if (status === "rejected") {
    request.rejectionReason = rejectionReason || "Rejected by admin";
  }

  await request.save();

  if (status === "approved") {
    // Apply changes to Attendance collection
    const d = new Date(request.date);
    d.setHours(0, 0, 0, 0);

    let workHours = 0;
    if (request.checkIn && request.checkOut) {
      workHours = (new Date(request.checkOut) - new Date(request.checkIn)) / 3600000;
    }

    const computedStatus = await resolveStatus(request.employee, request.checkIn, "present");

    await Attendance.findOneAndUpdate(
      { employee: request.employee, date: d },
      {
        employee: request.employee,
        date: d,
        status: computedStatus,
        checkIn: request.checkIn,
        checkOut: request.checkOut,
        workHours: parseFloat(workHours.toFixed(2)),
        notes: `Regularized: ${request.reason}`,
        markedBy: req.user._id,
        verifyMode: "manual",
      },
      { upsert: true, new: true }
    );
  }

  res.json({ success: true, data: request });
});
