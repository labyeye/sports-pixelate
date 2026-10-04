const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Company = require("../models/Company");
const { getCompanyFeatures } = require("../utils/planFeatures");
const { getCompanyAccess } = require("../utils/subscriptionStatus");

// Routes that must keep working when the academy's own NestPlay subscription
// has lapsed — otherwise the owner could never log in to renew it.
const SUBSCRIPTION_EXEMPT = [
  "/api/auth",
  "/api/billing",
  "/api/company",
  "/api/payment-methods",
  "/api/support",
  "/api/notifications",
  "/api/push",
];

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
    req.tokenClaims = decoded;
    if (!req.user || req.user.status === "inactive") {
      res.status(401);
      throw new Error("Not authorized");
    }
  } catch (err) {
    res.status(401);
    throw new Error("Not authorized, token invalid");
  }

  // The web UI already redirects lapsed academies to Billing; enforce it on the
  // API too so a stale token or a direct API call can't bypass the paywall.
  if (
    req.user.company &&
    !SUBSCRIPTION_EXEMPT.some((p) => req.baseUrl.startsWith(p))
  ) {
    const access = await getCompanyAccess(req.user.company);
    if (!access.live) {
      res.status(402);
      throw new Error(
        req.user.role === "super_admin"
          ? "Your NestPlay subscription has ended. Renew it from Billing to continue."
          : "Your academy's NestPlay subscription has ended. Please contact your administrator.",
      );
    }
  }
  next();
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

const authorize = (...roles) => {
  const guard = (req, res, next) => {
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
  // Exposed so the route-guard test can check which roles each route allows.
  guard.allowedRoles = roles;
  return guard;
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
