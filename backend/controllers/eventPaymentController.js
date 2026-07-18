const asyncHandler = require("express-async-handler");
const EventPayment = require("../models/EventPayment");
const Event = require("../models/Event");

// Read-only shell — no payment gateway wired up yet.
const listPayments = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, company: req.user.company });
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }
  const payments = await EventPayment.find({ event: event._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: payments });
});

module.exports = { listPayments };
