const mongoose = require("mongoose");

// One exit (offboarding) case for a staff member or a student: why they are
// leaving, the clearance checklist, the final settlement and the outcome.
// Completing it flips the person's status; reinstating undoes that.
const checklistItemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    required: { type: Boolean, default: true },
    done: { type: Boolean, default: false },
    doneAt: { type: Date },
    doneBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, default: "" },
  },
  { _id: false },
);

const exitRecordSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    personType: { type: String, enum: ["employee", "student"], required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    // Snapshot so the record stays readable even if the person is later edited.
    personName: { type: String, required: true },
    personCode: { type: String, default: "" }, // employeeId / studentId

    exitType: {
      type: String,
      enum: [
        "resignation",
        "termination",
        "retirement",
        "contract_end",
        "absconded",
        "course_completed",
        "withdrawn",
        "relocated",
        "fee_issue",
        "injury",
        "other",
      ],
      required: true,
    },
    reason: { type: String, default: "", trim: true },
    noticeDate: { type: Date },
    exitDate: { type: Date, required: true }, // last working day / last class

    status: {
      type: String,
      enum: ["initiated", "in_clearance", "completed", "cancelled", "reinstated"],
      default: "initiated",
    },
    checklist: [checklistItemSchema],

    settlementAmount: { type: Number, default: 0 }, // payable to staff / refundable to student's family
    settlementNotes: { type: String, default: "" },
    settlementPaid: { type: Boolean, default: false },

    feedback: { type: String, default: "" }, // exit interview / parent feedback
    eligibleForRehire: { type: Boolean, default: true },
    notes: { type: String, default: "" },

    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    completedAt: { type: Date },
    // Status the person had before completion, so "reinstate" can restore it.
    previousStatus: { type: String },
  },
  { timestamps: true },
);

exitRecordSchema.index({ company: 1, status: 1, exitDate: -1 });
exitRecordSchema.index({ company: 1, personType: 1 });
exitRecordSchema.index({ employee: 1 });
exitRecordSchema.index({ student: 1 });

module.exports = mongoose.model("ExitRecord", exitRecordSchema);
