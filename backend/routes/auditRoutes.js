const express = require("express");
const { getLogs } = require("../controllers/auditController");
const { protect, authorize, requirePlanFeature } = require("../middleware/auth");
const router = express.Router();

router.get(
  "/",
  protect,
  requirePlanFeature("auditLog"),
  authorize("super_admin", "hr_manager"),
  getLogs,
);

module.exports = router;
