const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const Payroll = require("../models/Payroll");
const Student = require("../models/Student");
const Department = require("../models/Department");
const Booking = require("../models/Booking");
const StudentSubscription = require("../models/StudentSubscription");

const getStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    const companyId = new mongoose.Types.ObjectId(req.user.company);
    const companyEmployeeIds = await Employee.find({ company: companyId })
      .select("_id")
      .lean()
      .then((docs) => docs.map((d) => d._id));

    const [
      totalEmployees,
      activeEmployees,
      newHires,
      pendingLeaves,
      todayPresent,
      totalStudents,
      departments,
      monthlyPayroll,
      totalBookings,
      todayBookings,
      subscriptionIncomeAgg,
    ] = await Promise.all([
      Employee.countDocuments({ company: companyId }).catch(() => 0),
      Employee.countDocuments({ company: companyId, status: "active" }).catch(
        () => 0,
      ),
      Employee.countDocuments({
        company: companyId,
        joinDate: { $gte: startOfMonth },
      }).catch(() => 0),
      Leave.countDocuments({ company: companyId, status: "pending" }).catch(
        () => 0,
      ),
      Attendance.countDocuments({
        employee: { $in: companyEmployeeIds },
        date: today,
        status: "present",
      }).catch(() => 0),
      Student.countDocuments({ company: companyId, status: "active" }).catch(
        () => 0,
      ),
      Department.countDocuments({ company: companyId }).catch(() => 0),
      Payroll.aggregate([
        {
          $match: {
            company: companyId,
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            status: "paid",
          },
        },
        { $group: { _id: null, total: { $sum: "$netSalary" } } },
      ]).catch(() => []),
      Booking.countDocuments({
        company: companyId,
        status: { $ne: "cancelled" },
      }).catch(() => 0),
      Booking.countDocuments({
        company: companyId,
        date: today,
        status: { $ne: "cancelled" },
      }).catch(() => 0),
      StudentSubscription.aggregate([
        {
          $match: {
            company: companyId,
            paymentStatus: "completed",
            updatedAt: { $gte: startOfMonth },
          },
        },
        { $group: { _id: null, total: { $sum: "$amountPaid" } } },
      ]).catch(() => []),
    ]);

    const subscriptionIncome = subscriptionIncomeAgg[0]?.total || 0;

    // Subscriptions ending within 7 days, or already past their renewal date
    // and still marked active/pending — surfaced so staff can chase renewals.
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
    const subscriptionAlerts = await StudentSubscription.find({
      company: companyId,
      status: { $in: ["active", "pending_renewal"] },
      renewalDate: { $lte: sevenDaysOut },
    })
      .populate("student", "firstName lastName studentId sport avatar")
      .sort({ renewalDate: 1 })
      .limit(10)
      .catch(() => []);

    const attendanceRate =
      activeEmployees > 0
        ? Math.round((todayPresent / activeEmployees) * 100)
        : 0;

    const recentHires = await Employee.find({
      company: companyId,
      joinDate: { $gte: startOfMonth },
    })
      .populate("department", "name")
      .sort({ joinDate: -1 })
      .limit(5)
      .select("firstName lastName designation department joinDate avatar")
      .catch(() => []);

    const pendingLeaveList = await Leave.find({
      company: companyId,
      status: "pending",
    })
      .populate({
        path: "employee",
        select: "firstName lastName designation",
        populate: { path: "department", select: "name" },
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .catch(() => []);

    const deptHeadcounts = await Employee.aggregate([
      { $match: { company: companyId, status: "active" } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "dept",
        },
      },
      { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ["$dept.name", "No Dept"] }, count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]).catch(() => []);

    const attTrend = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return Attendance.countDocuments({
          employee: { $in: companyEmployeeIds },
          date: { $gte: start, $lte: end },
          status: { $in: ["present", "late"] },
        }).then((count) => ({
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          count,
        }));
      }),
    );

    const payTrend = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return Payroll.aggregate([
          {
            $match: {
              company: req.user.company,
              month: d.getMonth() + 1,
              year: d.getFullYear(),
            },
          },
          { $group: { _id: null, total: { $sum: "$netSalary" } } },
        ]).then((r) => ({
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          total: r[0]?.total || 0,
        }));
      }),
    );

    const [todayLate, todayAbsent, todayOnLeave] = await Promise.all([
      Attendance.countDocuments({
        employee: { $in: companyEmployeeIds },
        date: today,
        status: "late",
      }).catch(() => 0),
      Attendance.countDocuments({
        employee: { $in: companyEmployeeIds },
        date: today,
        status: "absent",
      }).catch(() => 0),
      Attendance.countDocuments({
        employee: { $in: companyEmployeeIds },
        date: today,
        status: "on_leave",
      }).catch(() => 0),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalEmployees,
          activeEmployees,
          newHires,
          pendingLeaves,
          todayPresent,
          todayLate,
          todayAbsent,
          todayOnLeave,
          attendanceRate,
          totalStudents,
          departments,
          monthlyPayroll: monthlyPayroll[0]?.total || 0,
          totalBookings,
          todayBookings,
          subscriptionIncome,
        },
        recentHires,
        pendingLeaveList,
        deptHeadcounts,
        attTrend,
        payTrend,
        subscriptionAlerts,
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      data: {
        stats: {
          totalEmployees: 0,
          activeEmployees: 0,
          newHires: 0,
          pendingLeaves: 0,
          todayPresent: 0,
          attendanceRate: 0,
          totalStudents: 0,
          departments: 0,
          monthlyPayroll: 0,
          totalBookings: 0,
          todayBookings: 0,
          subscriptionIncome: 0,
        },
        recentHires: [],
        pendingLeaveList: [],
        deptHeadcounts: [],
        subscriptionAlerts: [],
      },
    });
  }
});

const getEmployeeStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const emp = await Employee.findOne({ user: req.user._id })
    .populate("shift")
    .populate("department");

  if (!emp) {
    res.status(404);
    throw new Error("Employee record not found");
  }

  // 1. Birthday wishes & Work anniversaries
  const isTodayUserBirthday = emp.dateOfBirth && 
    new Date(emp.dateOfBirth).getMonth() === now.getMonth() &&
    new Date(emp.dateOfBirth).getDate() === now.getDate();

  const isTodayUserAnniversary = emp.joinDate &&
    new Date(emp.joinDate).getMonth() === now.getMonth() &&
    new Date(emp.joinDate).getDate() === now.getDate();

  // Other employees birthdays today
  const allEmps = await Employee.find({
    company: req.user.company,
    _id: { $ne: emp._id },
    status: "active",
  }).select("firstName lastName dateOfBirth joinDate designation avatar");

  const todayBirthdays = allEmps.filter((e) => e.dateOfBirth &&
    new Date(e.dateOfBirth).getMonth() === now.getMonth() &&
    new Date(e.dateOfBirth).getDate() === now.getDate()
  );

  const todayAnniversaries = allEmps.filter((e) => e.joinDate &&
    new Date(e.joinDate).getMonth() === now.getMonth() &&
    new Date(e.joinDate).getDate() === now.getDate()
  );

  // 2. Upcoming Holidays (next 30 days)
  const Holiday = require("../models/Holiday");
  const thirtyDaysLater = new Date(today);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
  const upcomingHolidays = await Holiday.find({
    company: req.user.company,
    date: { $gte: today, $lte: thirtyDaysLater },
    isActive: true,
  }).sort({ date: 1 });

  // 3. Today's Shift
  const todayShift = emp.shift
    ? {
        name: emp.shift.name,
        startTime: emp.shift.startTime,
        endTime: emp.shift.endTime,
      }
    : {
        name: emp.shiftName || "General",
        startTime: "09:00",
        endTime: "18:00",
      };

  // 5. Pending Approvals Count (if manager/admin)
  let pendingApprovalsCount = 0;
  const isManager = ["super_admin", "hr_manager", "hr_executive"].includes(req.user.role) ||
    await Employee.exists({ company: req.user.company, reportingTo: emp._id });

  if (isManager) {
    const Leave = require("../models/Leave");
    const AttendanceCorrectionRequest = require("../models/AttendanceCorrectionRequest");

    const isAdmin = ["super_admin", "hr_manager", "hr_executive"].includes(req.user.role);
    let managerFilter = { company: req.user.company, status: "pending" };

    if (!isAdmin) {
      const reports = await Employee.find({ reportingTo: emp._id }).select("_id");
      const reportIds = reports.map((r) => r._id);
      managerFilter.employee = { $in: reportIds };
    }

    const [pendingLeaves, pendingCorrections] = await Promise.all([
      Leave.countDocuments(managerFilter).catch(() => 0),
      AttendanceCorrectionRequest.countDocuments(managerFilter).catch(() => 0),
    ]);

    pendingApprovalsCount = pendingLeaves + pendingCorrections;
  }

  // 6. Pending Salary
  const Payroll = require("../models/Payroll");
  const pendingSalary = await Payroll.find({
    employee: emp._id,
    status: { $ne: "paid" },
  }).sort({ year: -1, month: -1 });

  // 7. Company announcements
  const Announcement = require("../models/Announcement");
  const announcements = await Announcement.find({
    company: req.user.company,
    active: true,
  })
    .sort({ date: -1 })
    .limit(5);

  res.json({
    success: true,
    data: {
      birthdayWishes: {
        isTodayUserBirthday,
        todayBirthdays,
      },
      workAnniversary: {
        isTodayUserAnniversary,
        todayAnniversaries,
      },
      upcomingHolidays,
      todayShift,
      pendingApprovalsCount,
      pendingSalary,
      announcements,
    },
  });
});

module.exports = { getStats, getEmployeeStats };
