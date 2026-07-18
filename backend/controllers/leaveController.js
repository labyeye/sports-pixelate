const asyncHandler = require("express-async-handler");
const Leave = require("../models/Leave");
const Attendance = require("../models/Attendance");
const AttendanceBalance = require("../models/AttendanceBalance");
const Employee = require("../models/Employee");
const User = require("../models/User");
const Company = require("../models/Company");
const { safePagination } = require("../middleware/validate");
const {
  sendLeaveSubmitted,
  sendLeaveApproved,
  sendLeaveRejected,
  sendLeaveAppliedHR,
} = require("../services/whatsappService");
const {
  sendLeaveStatusEmail,
  sendLeaveAppliedEmail,
} = require("../services/notificationService");
const { logAudit } = require("../utils/auditLogger");

// Upsert attendance as on_leave for each day in the leave range (skip days that already have a check-in)
async function syncLeaveAttendance(leave) {
  const start = new Date(leave.startDate);
  const end = new Date(leave.endDate);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dayDate = new Date(d);
    await Attendance.findOneAndUpdate(
      {
        employee: leave.employee._id ?? leave.employee,
        date: dayDate,
        checkIn: { $exists: false },
      },
      {
        $set: {
          status: "on_leave",
          workHours: 0,
          notes: `Leave approved: ${leave.leaveType}`,
          leaveDeductSalary: leave.deductSalary !== false, // store for payroll reference
        },
        $setOnInsert: {
          employee: leave.employee._id ?? leave.employee,
          date: dayDate,
          verifyMode: "manual",
        },
      },
      { upsert: true },
    );
  }
}

// Revert on_leave attendance records back to absent when a leave is revoked
async function revertLeaveAttendance(leave) {
  const start = new Date(leave.startDate);
  const end = new Date(leave.endDate);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);

  await Attendance.updateMany(
    {
      employee: leave.employee._id ?? leave.employee,
      date: { $gte: start, $lte: end },
      status: "on_leave",
      checkIn: { $exists: false },
    },
    {
      $set: {
        status: "absent",
        notes: `Leave ${leave.status}: attendance reverted`,
      },
    },
  );
}

const LEAVE_TYPES = [
  "casual",
  "sick",
  "earned",
  "maternity",
  "paternity",
  "unpaid",
  "compensatory",
  "hourly",
  "wfh",
  "outdoor_duty",
];
const LEAVE_STATUS = ["pending", "approved", "rejected", "cancelled"];

const getLeaves = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { status, employeeId, leaveType, year, department } = req.query;

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
    const filter = { company: req.user.company, employee: selfEmp._id };
    if (status && LEAVE_STATUS.includes(status)) filter.status = status;
    if (leaveType && LEAVE_TYPES.includes(leaveType))
      filter.leaveType = leaveType;
    if (year) {
      const y = parseInt(year);
      if (!isNaN(y))
        filter.startDate = {
          $gte: new Date(`${y}-01-01`),
          $lte: new Date(`${y}-12-31`),
        };
    }
    const total = await Leave.countDocuments(filter);
    const leaves = await Leave.find(filter)
      .populate({
        path: "employee",
        select: "firstName lastName employeeId designation phone avatar",
        populate: { path: "department", select: "name" },
      })
      .populate("approvedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    return res.json({
      success: true,
      data: leaves,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  }

  const companyEmployees = await Employee.find({
    company: req.user.company,
  }).select("_id");
  const companyEmpIds = companyEmployees.map((e) => e._id);
  const filter = {
    company: req.user.company,
    employee: { $in: companyEmpIds },
  };

  if (status && LEAVE_STATUS.includes(status)) filter.status = status;
  if (leaveType && LEAVE_TYPES.includes(leaveType))
    filter.leaveType = leaveType;

  if (year) {
    const y = parseInt(year);
    if (!isNaN(y)) {
      filter.startDate = {
        $gte: new Date(`${y}-01-01`),
        $lte: new Date(`${y}-12-31`),
      };
    }
  }

  if (employeeId) {
    if (!companyEmpIds.some((id) => id.toString() === employeeId)) {
      return res.json({ success: true, data: [], total: 0 });
    }
    filter.employee = employeeId;
  } else if (department) {
    const empIds = await Employee.find({
      company: req.user.company,
      department,
    }).distinct("_id");
    filter.employee = { $in: empIds };
  }

  const total = await Leave.countDocuments(filter);
  const leaves = await Leave.find(filter)
    .populate({
      path: "employee",
      select: "firstName lastName employeeId designation phone avatar",
      populate: { path: "department", select: "name" },
    })
    .populate("approvedBy", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: leaves,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const createLeave = asyncHandler(async (req, res) => {
  let {
    employee,
    leaveType,
    startDate,
    endDate,
    days,
    reason,
    isHalfDay,
    halfDayType,
  } = req.body;

  let emp;
  if (req.user.role === "employee") {
    emp = await Employee.findOne({ user: req.user._id });
    if (!emp && req.user.email && req.user.company) {
      emp = await Employee.findOne({
        email: req.user.email.toLowerCase(),
        company: req.user.company,
      });
      if (emp) {
        await Employee.findByIdAndUpdate(emp._id, { user: req.user._id });
      }
    }
    if (!emp) {
      res.status(404);
      throw new Error("Employee record not found for your account");
    }
    employee = emp._id;
  } else {
    emp = await Employee.findOne({
      _id: employee,
      company: req.user.company,
    });
    if (!emp) {
      res.status(404);
      throw new Error("Employee not found");
    }
  }

  if (!leaveType || !LEAVE_TYPES.includes(leaveType)) {
    res.status(400);
    throw new Error("Invalid leave type");
  }
  if (!startDate || !endDate || !days || !reason) {
    res.status(400);
    throw new Error("startDate, endDate, days, and reason are required");
  }
  if (typeof reason === "string" && reason.trim().length > 500) {
    res.status(400);
    throw new Error("Reason must be under 500 characters");
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    res.status(400);
    throw new Error("Invalid date range");
  }
  const daysNum = Number(days);
  if (isNaN(daysNum) || daysNum <= 0 || daysNum > 365) {
    res.status(400);
    throw new Error("Invalid days value");
  }

  const overlap = await Leave.findOne({
    employee,
    status: { $in: ["pending", "approved"] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });
  if (overlap) {
    res.status(400);
    throw new Error(
      "Employee already has a leave request overlapping these dates",
    );
  }

  // Check current-month AttendanceBalance for this leave type — if enough
  // balance remains, deduct from it and mark as no-deduction; otherwise leave
  // deductSalary at its schema default and flag noBalanceLeft for HR.
  // Balance is only decremented after the Leave record is created below, so a
  // failed create never leaves a stray deduction with no request to match it.
  const balance = await AttendanceBalance.getOrCreateCurrentMonth(
    employee,
    req.user.company,
  );
  const leaveBalanceEntry = balance.leaveUsed.find(
    (l) => l.leaveType === leaveType,
  );
  const remaining = leaveBalanceEntry
    ? leaveBalanceEntry.daysAllowed - leaveBalanceEntry.daysUsed
    : 0;
  const willDeductFromBalance = leaveBalanceEntry && remaining >= daysNum;
  const noBalanceLeft = !willDeductFromBalance;

  const leave = await Leave.create({
    company: req.user.company,
    employee,
    leaveType,
    startDate: start,
    endDate: end,
    days: daysNum,
    reason: reason.trim(),
    isHalfDay: !!isHalfDay,
    halfDayType: isHalfDay ? halfDayType : undefined,
    startHour: req.body.startHour,
    endHour: req.body.endHour,
    ...(willDeductFromBalance ? { deductSalary: false } : {}),
  });

  if (willDeductFromBalance) {
    leaveBalanceEntry.daysUsed += daysNum;
    await balance.save();
  }

  try {
    // Notify employee that their request was submitted
    if (emp.phone) {
      await sendLeaveSubmitted(
        emp.phone,
        {
          firstName: emp.firstName,
          leaveType: leave.leaveType,
          startDate: leave.startDate,
          endDate: leave.endDate,
          days: leave.days,
        },
        req.user.company,
      );
    }

    // Notify all HR/admin — use Company.phone as fallback if user.phone is empty
    const company = await Company.findById(req.user.company).select("phone");
    const hrUsers = await User.find({
      company: req.user.company,
      role: { $in: ["super_admin", "hr_manager"] },
    }).select("phone email name role");

    for (const hr of hrUsers) {
      const phone =
        hr.phone || (hr.role === "super_admin" ? company?.phone : null);
      if (phone)
        await sendLeaveAppliedHR(
          phone,
          {
            empName: `${emp.firstName} ${emp.lastName}`,
            empId: emp.employeeId,
            leaveType: leave.leaveType,
            startDate: leave.startDate,
            endDate: leave.endDate,
            days: leave.days,
            reason: leave.reason,
          },
          req.user.company,
        );
      if (hr.email)
        await sendLeaveAppliedEmail({
          toEmail: hr.email,
          toName: hr.name,
          empName: `${emp.firstName} ${emp.lastName}`,
          leaveType: leave.leaveType,
          startDate: leave.startDate,
          endDate: leave.endDate,
          days: leave.days,
          reason: leave.reason,
        });
    }
  } catch {}

  res.status(201).json({ success: true, data: leave, noBalanceLeft });
});

const updateLeaveStatus = asyncHandler(async (req, res) => {
  const { status, rejectionReason, deductSalary } = req.body;

  if (!status || !LEAVE_STATUS.includes(status)) {
    res.status(400);
    throw new Error("Invalid status value");
  }

  const leave = await Leave.findOne({
    _id: req.params.id,
    company: req.user.company,
  }).populate({
    path: "employee",
    select: "firstName lastName employeeId phone user",
    populate: { path: "user", select: "email name" },
  });
  if (!leave) {
    res.status(404);
    throw new Error("Leave not found");
  }

  const previousStatus = leave.status;
  leave.status = status;
  if (status === "approved") {
    leave.approvedBy = req.user._id;
    leave.approvedAt = new Date();
    // deductSalary: true = unpaid (deduct from salary), false = paid leave
    if (deductSalary !== undefined) {
      leave.deductSalary = !!deductSalary;
    } else {
      // Default: unpaid leave type always deducts; others don't
      leave.deductSalary = leave.leaveType === "unpaid";
    }
  }
  if (status === "rejected") {
    if (rejectionReason && typeof rejectionReason === "string") {
      leave.rejectionReason = rejectionReason.trim().slice(0, 500);
    }
  }
  await leave.save();

  // Sync attendance records based on status transition
  try {
    if (status === "approved") {
      await syncLeaveAttendance(leave);
    } else if (
      previousStatus === "approved" &&
      (status === "rejected" || status === "cancelled")
    ) {
      await revertLeaveAttendance(leave);
    }
  } catch (err) {
    console.error("[LeaveSync] Attendance sync failed:", err.message);
  }

  try {
    if (leave.employee?.phone) {
      if (status === "approved") {
        await sendLeaveApproved(
          leave.employee.phone,
          {
            firstName: leave.employee.firstName,
            leaveType: leave.leaveType,
            startDate: leave.startDate,
            endDate: leave.endDate,
            days: leave.days,
          },
          req.user.company,
        );
      } else if (status === "rejected") {
        await sendLeaveRejected(
          leave.employee.phone,
          {
            firstName: leave.employee.firstName,
            leaveType: leave.leaveType,
            reason: rejectionReason,
          },
          req.user.company,
        );
      }
    }
    if (
      leave.employee?.user?.email &&
      (status === "approved" || status === "rejected")
    ) {
      await sendLeaveStatusEmail({
        toEmail: leave.employee.user.email,
        toName: `${leave.employee.firstName} ${leave.employee.lastName}`,
        status,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        days: leave.days,
        rejectionReason,
      });
    }
  } catch {}

  await logAudit(req, `leave_${status}`, "Leave", leave._id, {
    employeeName: `${leave.employee?.firstName} ${leave.employee?.lastName}`,
    leaveType: leave.leaveType,
    days: leave.days,
  });

  res.json({ success: true, data: leave });
});

// Edit a leave — employee can only edit own pending; admins can edit any
const updateLeave = asyncHandler(async (req, res) => {
  const isAdmin = ["super_admin", "admin", "hr_manager"].includes(
    req.user.role,
  );

  let leave;
  if (isAdmin) {
    leave = await Leave.findOne({
      _id: req.params.id,
      company: req.user.company,
    });
  } else {
    const selfEmp = await Employee.findOne({ user: req.user._id });
    if (!selfEmp) {
      res.status(404);
      throw new Error("Employee record not found");
    }
    leave = await Leave.findOne({
      _id: req.params.id,
      company: req.user.company,
      employee: selfEmp._id,
    });
    if (leave && leave.status !== "pending") {
      res.status(400);
      throw new Error("Only pending leave requests can be edited");
    }
  }

  if (!leave) {
    res.status(404);
    throw new Error("Leave not found");
  }

  const {
    leaveType,
    startDate,
    endDate,
    days,
    reason,
    isHalfDay,
    halfDayType,
  } = req.body;

  if (leaveType && LEAVE_TYPES.includes(leaveType)) leave.leaveType = leaveType;
  if (reason && typeof reason === "string")
    leave.reason = reason.trim().slice(0, 500);
  if (isHalfDay !== undefined) {
    leave.isHalfDay = !!isHalfDay;
    leave.halfDayType = isHalfDay ? halfDayType : undefined;
  }
  if (req.body.startHour !== undefined) leave.startHour = req.body.startHour;
  if (req.body.endHour !== undefined) leave.endHour = req.body.endHour;

  if (startDate && endDate && days) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysNum = Number(days);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      res.status(400);
      throw new Error("Invalid date range");
    }
    if (isNaN(daysNum) || daysNum <= 0) {
      res.status(400);
      throw new Error("Invalid days value");
    }
    const overlap = await Leave.findOne({
      _id: { $ne: leave._id },
      employee: leave.employee,
      status: { $in: ["pending", "approved"] },
      startDate: { $lte: end },
      endDate: { $gte: start },
    });
    if (overlap) {
      res.status(400);
      throw new Error("Another leave request overlaps these dates");
    }
    leave.startDate = start;
    leave.endDate = end;
    leave.days = daysNum;
  }

  await leave.save();
  res.json({ success: true, data: leave });
});

const deleteLeave = asyncHandler(async (req, res) => {
  const { cancellationReason } = req.body || {};
  const isAdmin = ["super_admin", "admin", "hr_manager"].includes(
    req.user.role,
  );
  const filter = { _id: req.params.id, company: req.user.company };

  if (!isAdmin) {
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
    if (!selfEmp) {
      res.status(404);
      throw new Error("Employee record not found");
    }
    filter.employee = selfEmp._id;
  }

  const leave = await Leave.findOne(filter).populate({
    path: "employee",
    select: "firstName lastName phone",
  });
  if (!leave) {
    res.status(404);
    throw new Error("Leave not found");
  }

  if (!isAdmin && leave.status !== "pending") {
    res.status(400);
    throw new Error("Only pending leave requests can be withdrawn");
  }

  // When cancelling an approved leave, mark as cancelled and notify employee
  if (leave.status === "approved") {
    if (!cancellationReason || !cancellationReason.trim()) {
      res.status(400);
      throw new Error("A reason is required to cancel an approved leave");
    }
    leave.status = "cancelled";
    leave.rejectionReason = cancellationReason.trim().slice(0, 500);
    await leave.save();

    try {
      if (leave.employee?.phone) {
        // Reuse neshr_leave_rejected template: params [firstName, leaveType, reason]
        await sendLeaveRejected(
          leave.employee.phone,
          {
            firstName: leave.employee.firstName,
            leaveType: leave.leaveType,
            reason: `Cancelled — ${cancellationReason}`,
          },
          req.user.company,
        );
      }
    } catch {}

    return res.json({
      success: true,
      message: "Approved leave cancelled",
      data: leave,
    });
  }

  await leave.deleteOne();
  res.json({ success: true, message: "Leave request withdrawn" });
});

module.exports = {
  getLeaves,
  createLeave,
  updateLeave,
  updateLeaveStatus,
  deleteLeave,
};
