const mongoose = require("mongoose");

// Read-only shell this pass — no payment gateway integration yet. Listing
// endpoint only; rows would be populated by a future payments subsystem.
const eventPaymentSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
  },
  { timestamps: true },
);

eventPaymentSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model("EventPayment", eventPaymentSchema);
