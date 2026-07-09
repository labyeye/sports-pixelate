const mongoose = require("mongoose");

const employeePayrollConfigSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    basicSalary: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    da: { type: Number, default: 0 },
    ta: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },
  },
  { timestamps: true },
);

employeePayrollConfigSchema.index({ employee: 1 }, { unique: true });

module.exports = mongoose.model(
  "EmployeePayrollConfig",
  employeePayrollConfigSchema,
);
