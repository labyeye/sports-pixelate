const mongoose = require("mongoose");

// One document per company. limits maps category -> max amount per claim (0 / missing = no limit).
const expensePolicySchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, unique: true },
    limits: { type: Map, of: Number, default: {} },
    billRequiredAbove: { type: Number, default: 0, min: 0 }, // bill mandatory for claims above this amount
  },
  { timestamps: true },
);

module.exports = mongoose.model("ExpensePolicy", expensePolicySchema);
