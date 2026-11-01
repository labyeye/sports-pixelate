const asyncHandler = require("express-async-handler");
const OfferLetter = require("../models/OfferLetter");
const bodyFor = require("../utils/bodyFor");

const DEFAULT_TEMPLATES = [
  {
    name: "Standard Offer Letter",
    forRole: "All",
    body: "Dear {{name}},\n\nWe are pleased to offer you the position of {{designation}} at {{company}}.\n\nYour starting date will be {{joiningDate}} and your CTC will be ₹{{ctc}} per annum.\n\nKindly sign and return this letter as acceptance.\n\nWarm regards,\nAcademy Management",
  },
  {
    name: "Appointment Letter",
    forRole: "All",
    body: "Dear {{name}},\n\nThis is to confirm your appointment as {{designation}} effective {{joiningDate}}.\n\nYour employment is subject to our standard terms and conditions.\n\nAcademy Management",
  },
  {
    name: "Experience Certificate",
    forRole: "All",
    body: "To Whom It May Concern,\n\nThis is to certify that {{name}} (ID: {{empId}}) has worked with us as {{designation}} from {{fromDate}} to {{toDate}}.\n\nWe wish them the best in their future endeavors.\n\nAcademy Management",
  },
  {
    name: "Relieving Letter",
    forRole: "All",
    body: "Dear {{name}},\n\nThis is to acknowledge that you have been relieved from your duties as {{designation}} effective {{exitDate}}.\n\nWe thank you for your contribution and wish you success.\n\nAcademy Management",
  },
];

const getOfferLetters = asyncHandler(async (req, res) => {
  let letters = await OfferLetter.find({ company: req.user.company }).sort({
    createdAt: -1,
  });
  if (letters.length === 0) {
    letters = await OfferLetter.insertMany(
      DEFAULT_TEMPLATES.map((t) => ({ ...t, company: req.user.company })),
    );
  }
  res.json({ success: true, data: letters });
});

const createOfferLetter = asyncHandler(async (req, res) => {
  const letter = await OfferLetter.create({
    ...bodyFor(OfferLetter, req.body),
    company: req.user.company,
  });
  res.status(201).json({ success: true, data: letter });
});

const updateOfferLetter = asyncHandler(async (req, res) => {
  const letter = await OfferLetter.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    bodyFor(OfferLetter, req.body),
    { new: true },
  );
  if (!letter)
    return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: letter });
});

const deleteOfferLetter = asyncHandler(async (req, res) => {
  await OfferLetter.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  res.json({ success: true, message: "Deleted" });
});

module.exports = {
  getOfferLetters,
  createOfferLetter,
  updateOfferLetter,
  deleteOfferLetter,
};
