const mongoose = require("mongoose");

const attendanceBalanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    month: { type: String, required: true }, // 'YYYY-MM'
    lateUsed: { type: Number, default: 0 },
    lateAllowed: { type: Number, default: 0 }, // snapshot at month creation
    leaveUsed: [
      {
        leaveType: { type: String, required: true },
        daysUsed: { type: Number, default: 0 },
        daysAllowed: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true },
);

attendanceBalanceSchema.index({ employee: 1, month: 1 }, { unique: true });

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Returns the current month's balance doc for an employee, creating it (seeded
// from DeductionRule.lateAllowance + LeaveAllowance) if it doesn't exist yet.
// ponytail: lazy per-employee creation on first access instead of a monthly cron reset.
attendanceBalanceSchema.statics.getOrCreateCurrentMonth = async function (
  employeeId,
  companyId,
) {
  const month = currentMonthKey();
  let balance = await this.findOne({ employee: employeeId, month });
  if (balance) return balance;

  const DeductionRule = require("./DeductionRule");
  const LeaveAllowance = require("./LeaveAllowance");

  const rule = await DeductionRule.findOne({ company: companyId });
  let lateAllowed = rule?.lateAllowance?.bulkCount || 0;
  if (rule?.lateAllowance?.mode === "custom") {
    const override = rule.lateAllowance.perEmployee?.find(
      (p) => p.employee?.toString() === employeeId.toString(),
    );
    lateAllowed = override ? override.count : 0;
  }

  const leaveRules = await LeaveAllowance.find({ company: companyId });
  const leaveUsed = leaveRules.map((lr) => {
    let daysAllowed = lr.mode === "bulk" ? lr.bulkDays : 0;
    if (lr.mode === "custom") {
      const override = lr.perEmployee?.find(
        (p) => p.employee?.toString() === employeeId.toString(),
      );
      daysAllowed = override ? override.days : 0;
    }
    return { leaveType: lr.leaveType, daysUsed: 0, daysAllowed };
  });

  try {
    balance = await this.create({
      employee: employeeId,
      company: companyId,
      month,
      lateUsed: 0,
      lateAllowed,
      leaveUsed,
    });
  } catch (err) {
    // Race: another request created it first — fetch instead.
    if (err.code === 11000) {
      balance = await this.findOne({ employee: employeeId, month });
    } else {
      throw err;
    }
  }
  return balance;
};

// Applies an updated DeductionRule.lateAllowance to the current month's
// already-created balance docs, so a mid-month change takes effect immediately
// instead of only from next month's fresh snapshot.
attendanceBalanceSchema.statics.syncCurrentMonthLateAllowance = async function (
  companyId,
  lateAllowance,
) {
  const month = currentMonthKey();
  if (lateAllowance?.mode === "custom") {
    const overrides = lateAllowance.perEmployee || [];
    await Promise.all(
      overrides.map((o) =>
        this.updateOne(
          { company: companyId, month, employee: o.employee },
          { $set: { lateAllowed: Number(o.count) || 0 } },
        ),
      ),
    );
    await this.updateMany(
      {
        company: companyId,
        month,
        employee: { $nin: overrides.map((o) => o.employee) },
      },
      { $set: { lateAllowed: 0 } },
    );
  } else {
    await this.updateMany(
      { company: companyId, month },
      { $set: { lateAllowed: Number(lateAllowance?.bulkCount) || 0 } },
    );
  }
};

// Applies an updated LeaveAllowance to the current month's already-created
// balance docs' matching leaveUsed entry, same reasoning as above.
attendanceBalanceSchema.statics.syncCurrentMonthLeaveAllowance =
  async function (companyId, leaveType, allowance) {
    const month = currentMonthKey();
    const balances = await this.find({ company: companyId, month });
    await Promise.all(
      balances.map((balance) => {
        const entry = balance.leaveUsed.find((l) => l.leaveType === leaveType);
        let daysAllowed = allowance.mode === "bulk" ? allowance.bulkDays : 0;
        if (allowance.mode === "custom") {
          const override = allowance.perEmployee?.find(
            (p) => p.employee?.toString() === balance.employee.toString(),
          );
          daysAllowed = override ? override.days : 0;
        }
        if (entry) {
          entry.daysAllowed = daysAllowed;
        } else {
          balance.leaveUsed.push({ leaveType, daysUsed: 0, daysAllowed });
        }
        return balance.save();
      }),
    );
  };

module.exports = mongoose.model("AttendanceBalance", attendanceBalanceSchema);
