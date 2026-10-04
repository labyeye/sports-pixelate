const jwt = require("jsonwebtoken");

// `claims` carries extras like { otp: true } (phone proven via WhatsApp code).
const generateToken = (id, claims = {}) =>
  jwt.sign({ id, ...claims }, process.env.JWT_SECRET, { expiresIn: "30d" });

module.exports = generateToken;
