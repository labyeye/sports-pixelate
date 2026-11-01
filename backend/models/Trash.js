const mongoose = require("mongoose");

// Recoverable deletes: a deleted record is copied here (so it can be restored)
// before it is removed from its own collection. Auto-purged after 30 days.
const trashSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    modelName: {
      type: String,
      required: true,
      enum: ["Leave", "Announcement", "EmployeeDocument", "Expense", "Task"],
    },
    originalId: { type: mongoose.Schema.Types.ObjectId, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletedByName: { type: String, default: "" },
  },
  { timestamps: true },
);

trashSchema.index({ company: 1, createdAt: -1 });
trashSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

module.exports = mongoose.models.Trash || mongoose.model("Trash", trashSchema);
