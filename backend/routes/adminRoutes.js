const express = require("express");
const {
  getSaasStats,
  updateCompanyTier,
} = require("../controllers/adminController");
const { protectPlatformAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/stats", protectPlatformAdmin, getSaasStats);
router.patch(
  "/companies/:companyId/tier",
  protectPlatformAdmin,
  updateCompanyTier,
);

module.exports = router;
