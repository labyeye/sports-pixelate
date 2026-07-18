const asyncHandler = require("express-async-handler");
const LateApproval = require("../models/LateApproval");
const Attendance = require("../models/Attendance");

const getLateApprovals = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = { company: req.user.company };
  filter.status =
    status && ["pending", "approved", "rejected"].includes(status)
      ? status
      : "pending";

  const approvals = await LateApproval.find(filter)
    .populate({
      path: "employee",
      select: "firstName lastName employeeId designation department avatar",
      populate: { path: "department", select: "name" },
    })
    .sort({ createdAt: -1 });

  res.json({ success: true, data: approvals });
});

const resolveLateApproval = asyncHandler(async (req, res) => {
  const { resolvedStatus } = req.body;
  if (!["present", "late", "absent", "half_day"].includes(resolvedStatus)) {
    res.status(400);
    throw new Error("Invalid resolvedStatus");
  }

  const approval = await LateApproval.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!approval) {
    res.status(404);
    throw new Error("Late approval not found");
  }

  approval.status = "approved";
  approval.resolvedStatus = resolvedStatus;
  approval.resolvedBy = req.user._id;
  approval.resolvedAt = new Date();
  await approval.save();

  await Attendance.findOneAndUpdate(
    { employee: approval.employee, date: approval.date },
    { status: resolvedStatus, approvalPending: false },
  );

  res.json({ success: true, data: approval });
});

module.exports = { getLateApprovals, resolveLateApproval };
