const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Company = require("../models/Company");
const { getCompanyFeatures } = require("../utils/planFeatures");

const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user || req.user.status === "inactive") {
      res.status(401);
      throw new Error("Not authorized");
    }
    next();
  } catch (err) {
    res.status(401);
    throw new Error("Not authorized, token invalid");
  }
});

const protectCompany = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.company = await Company.findById(decoded.id).select("-password");
    if (!req.company) {
      res.status(401);
      throw new Error("Not authorized");
    }
    next();
  } catch (err) {
    res.status(401);
    throw new Error("Not authorized, token invalid");
  }
});

const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error("Not authorized");
    }
    if (!roles.includes(req.user.role)) {
      res.status(403);
      throw new Error("You do not have permission to perform this action");
    }
    next();
  };

const requirePlanFeature = (featureKey) =>
  asyncHandler(async (req, res, next) => {
    const features = await getCompanyFeatures(req.user.company);
    if (!features[featureKey]) {
      res.status(403);
      throw new Error(
        `Your plan does not include ${featureKey}. Ask your admin to upgrade.`,
      );
    }
    next();
  });

// Platform-admin guard — verifies JWT issued specifically for the SaaS admin panel
const protectPlatformAdmin = (req, res, next) => {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token)
    return res.status(401).json({ success: false, message: "No token" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "platform_admin" || decoded.iss !== "nesthr-platform")
      return res.status(403).json({ success: false, message: "Forbidden" });
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

module.exports = {
  protect,
  protectCompany,
  authorize,
  requirePlanFeature,
  protectPlatformAdmin,
};
