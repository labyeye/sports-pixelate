const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const { escapeRegex } = require("../middleware/validate");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// List every parent/guardian login account for this company, with the
// children they're linked to — mirrors the employee list on the Credentials
// page so admins can manage both from the same place.
const getParents = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = { company: req.user.company, role: "parent" };
  if (search) {
    const s = escapeRegex(String(search).slice(0, 100));
    filter.$or = [
      { name: { $regex: s, $options: "i" } },
      { email: { $regex: s, $options: "i" } },
      { phone: { $regex: s, $options: "i" } },
    ];
  }

  const parents = await User.find(filter)
    .select("name email phone avatar lastLogin children createdAt")
    .populate("children", "firstName lastName studentId")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: parents });
});

// Admin-set real credentials for a parent — lets them log in with
// email + password in addition to phone OTP.
const updateParentCredentials = asyncHandler(async (req, res) => {
  const parent = await User.findOne({
    _id: req.params.id,
    company: req.user.company,
    role: "parent",
  });
  if (!parent) {
    res.status(404);
    throw new Error("Parent not found");
  }

  const { email, password } = req.body;

  if (email !== undefined) {
    const normalized = String(email).toLowerCase().trim();
    if (!EMAIL_RE.test(normalized)) {
      res.status(400);
      throw new Error("Please provide a valid email address");
    }
    const existing = await User.findOne({
      email: normalized,
      _id: { $ne: parent._id },
    });
    if (existing) {
      res.status(400);
      throw new Error("Email already in use by another account");
    }
    parent.email = normalized;
  }

  if (password !== undefined) {
    if (typeof password !== "string" || password.length < 6) {
      res.status(400);
      throw new Error("Password must be at least 6 characters");
    }
    if (password.length > 128) {
      res.status(400);
      throw new Error("Password too long");
    }
    parent.password = password;
  }

  await parent.save();

  res.json({
    success: true,
    data: { _id: parent._id, name: parent.name, email: parent.email },
  });
});

module.exports = { getParents, updateParentCredentials };
