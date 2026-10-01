const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    facility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Facility",
      required: true,
    },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" }, // who it's for (optional — could be staff-only booking)
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: { type: Date, required: true }, // day of the booking (midnight)
    startTime: { type: String, required: true }, // "HH:MM"
    endTime: { type: String, required: true }, // "HH:MM"
    fee: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["confirmed", "cancelled", "completed"],
      default: "confirmed",
    },
    paymentStatus: {
      type: String,
      enum: ["not_required", "pending", "completed"],
      default: "not_required",
    },
    // Generic online-order fields — the name predates multi-gateway support
    // but holds whichever gateway's order/payment id; `paymentGateway` says
    // which.
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    paymentGateway: {
      type: String,
      enum: ["razorpay", "cashfree", "phonepe", "paytm"],
      default: "razorpay",
    },
    notes: { type: String },
    // Inventory gear taken for this booking. Stock is deducted when the
    // booking is created (an assignment is pushed on the InventoryItem) and
    // restored when the return is recorded or the booking is cancelled.
    items: [
      {
        item: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem" },
        quantity: { type: Number, default: 1, min: 1 },
        assignmentId: { type: mongoose.Schema.Types.ObjectId },
        returnedAt: { type: Date },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Booking", bookingSchema);
