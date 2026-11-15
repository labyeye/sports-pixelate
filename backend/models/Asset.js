const mongoose = require("mongoose");

const assetSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    name: { type: String, required: true, trim: true },
    assetType: {
      type: String,
      required: true,
      enum: ["laptop", "mouse", "keyboard", "sim", "vehicle", "other"],
    },
    serialNumber: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["assigned", "available", "damaged", "returned"],
      default: "available",
    },
    assignmentDate: { type: Date },
    returnDate: { type: Date },
    history: [
      {
        employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
        assignedAt: { type: Date, default: Date.now },
        returnedAt: { type: Date },
        notes: String,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Asset", assetSchema);
