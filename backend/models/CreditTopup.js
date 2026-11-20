const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    packId: { type: String, required: true },
    credits: { type: Number, required: true },
    price: { type: Number, required: true }, // before GST
    gst: { type: Number, required: true },
    total: { type: Number, required: true }, // what Razorpay charged
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String },
    status: { type: String, enum: ["created", "paid"], default: "created" },
    invoiceNumber: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CreditTopup", schema);
