const mongoose = require("mongoose");

const salaryHeadSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["Earning", "Deduction", "Variable"],
      required: true,
    },
    calcMethod: {
      type: String,
      enum: [
        "fixed",
        "percent_of_basic",
        "percent_of_gross",
        "formula",
        "as_per_loan",
      ],
      default: "fixed",
    },
    value: { type: Number, default: 0 },
    taxable: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SalaryHead", salaryHeadSchema);
