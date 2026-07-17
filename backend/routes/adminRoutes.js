const express = require("express");
const {
  getSaasStats,
  listOfferCodes,
  createOfferCode,
  updateOfferCode,
} = require("../controllers/adminController");
const { protectPlatformAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/stats", protectPlatformAdmin, getSaasStats);

router.get("/offer-codes", protectPlatformAdmin, listOfferCodes);
router.post("/offer-codes", protectPlatformAdmin, createOfferCode);
router.patch("/offer-codes/:id", protectPlatformAdmin, updateOfferCode);

module.exports = router;
