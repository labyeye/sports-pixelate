const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ["allowance", "penalty", "overtime"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    hours: { type: Number, default: 0 },
    date: { type: Date, required: true },
    remark: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "applied"],
      default: "pending",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Transaction", transactionSchema);
