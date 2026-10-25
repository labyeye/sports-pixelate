const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Student = require("../models/Student");
const Session = require("../models/Session");
const ConsentRecord = require("../models/ConsentRecord");
const { logAudit } = require("../utils/auditLogger");

// Data-subject rights: a signed-in user can download everything we hold about
// them, and delete (anonymise) their own account.
const STUDENT_HIDDEN = "-faceDescriptor -deviceFaceTemplate";
const EMPLOYEE_HIDDEN = "-faceDescriptor -deviceFaceTemplate";

const exportMyData = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).lean();
  if (user) {
    delete user.password;
    delete user.passkeys;
    delete user.tokenVersion;
  }
  const [employee, children, consents, sessions] = await Promise.all([
    Employee.findOne({ user: req.user._id }).select(EMPLOYEE_HIDDEN),
    req.user.children?.length
      ? Student.find({
          _id: { $in: req.user.children },
          company: req.user.company,
        }).select(STUDENT_HIDDEN)
      : [],
    ConsentRecord.find({ user: req.user._id }).sort({ grantedAt: -1 }).lean(),
    Session.find({ userId: req.user._id })
      .select("deviceName platform lastActiveAt createdAt")
      .lean(),
  ]);
  await logAudit(req, "personal_data_exported", "User", req.user._id);
  res.json({
    success: true,
    data: {
      exportedAt: new Date().toISOString(),
      account: user,
      employeeRecord: employee ? employee.toJSON() : null,
      children: children.map((c) => c.toJSON()),
      consents,
      signedInDevices: sessions,
    },
  });
});

const deleteMyAccount = asyncHandler(async (req, res) => {
  const { password } = req.body || {};
  const user = await User.findById(req.user._id).select("+password");
  if (!password || !(await user.matchPassword(String(password)))) {
    res.status(401);
    throw new Error("Incorrect password");
  }
  if (user.role === "super_admin") {
    res.status(403);
    throw new Error(
      "Academy owners can't delete their account here because it would remove the whole academy. Contact support to close the academy.",
    );
  }

  await logAudit(req, "account_deleted", "User", user._id, {
    role: user.role,
  });

  // Personal details go; payroll/attendance history stays under an anonymous record.
  await Employee.updateMany(
    { user: user._id },
    {
      $set: { status: "terminated", exitDate: new Date() },
      $unset: {
        bankAccount: 1,
        ifscCode: 1,
        panNumber: 1,
        aadharNumber: 1,
        personalEmail: 1,
        alternatePhone: 1,
        address: 1,
        permanentAddress: 1,
        emergencyContact: 1,
        avatar: 1,
        faceDescriptor: 1,
        deviceFaceTemplate: 1,
      },
    },
  );
  await Student.updateMany({ parents: user._id }, { $pull: { parents: user._id } });
  await Session.deleteMany({ userId: user._id });
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        name: "Deleted user",
        email: `deleted-${user._id}@deleted.invalid`,
        status: "inactive",
        twoFactorEnabled: false,
        children: [],
        trustedDevices: [],
        passkeys: [],
      },
      $unset: {
        phone: 1,
        avatar: 1,
        twoFactorSecret: 1,
        twoFactorBackupCodes: 1,
        backupCodes: 1,
        pendingEmail: 1,
      },
      $inc: { tokenVersion: 1 },
    },
  );
  res.json({ success: true, message: "Your account has been deleted." });
});

module.exports = { exportMyData, deleteMyAccount };
