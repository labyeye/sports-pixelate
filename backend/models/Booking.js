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
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    notes: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Booking", bookingSchema);
