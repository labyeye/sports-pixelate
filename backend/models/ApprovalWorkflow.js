const mongoose = require("mongoose");

// One document per company + request type. Steps run in order; a step with aboveAmount only applies
// when the request amount is >= that value (e.g. super_admin sign-off only for big claims).
const approvalWorkflowSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    type: { type: String, enum: ["expense"], default: "expense" },
    steps: [
      {
        _id: false,
        role: { type: String, enum: ["department_head", "hr_manager", "super_admin"], required: true },
        aboveAmount: { type: Number, default: 0, min: 0 },
      },
    ],
  },
  { timestamps: true },
);

approvalWorkflowSchema.index({ company: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("ApprovalWorkflow", approvalWorkflowSchema);
