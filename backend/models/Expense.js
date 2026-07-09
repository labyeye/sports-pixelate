const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "equipment",
        "facility_maintenance",
        "salaries",
        "utilities",
        "marketing",
        "travel",
        "other",
      ],
    },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    description: { type: String, default: "" },
    receiptUrl: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Expense", expenseSchema);
