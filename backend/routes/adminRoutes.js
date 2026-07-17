const express = require("express");
const {
  getSaasStats,
  updateCompanyTier,
  listOfferCodes,
  createOfferCode,
  updateOfferCode,
} = require("../controllers/adminController");
const { protectPlatformAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/stats", protectPlatformAdmin, getSaasStats);
router.patch(
  "/companies/:companyId/tier",
  protectPlatformAdmin,
  updateCompanyTier,
);

router.get("/offer-codes", protectPlatformAdmin, listOfferCodes);
router.post("/offer-codes", protectPlatformAdmin, createOfferCode);
router.patch("/offer-codes/:id", protectPlatformAdmin, updateOfferCode);

module.exports = router;
