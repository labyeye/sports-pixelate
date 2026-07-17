const express = require("express");
const router = express.Router();
const {
  getCrmInvoices,
  getCrmOffers,
  getCrmOfferById,
  createCrmOffer,
  updateCrmOffer,
  deleteCrmOffer,
  updateCrmSubscription,
} = require("../controllers/crmController");

// No JWT here — every handler guards itself with the CRM_API_SECRET
// x-api-key check (see crmController.crmAuth), same pattern as /internal/stats.
router.get("/invoices", getCrmInvoices);
router.patch("/companies/:companyId/subscription", updateCrmSubscription);

router.get("/offers", getCrmOffers);
router.get("/offers/:id", getCrmOfferById);
router.post("/offers", createCrmOffer);
router.patch("/offers/:id", updateCrmOffer);
router.delete("/offers/:id", deleteCrmOffer);

module.exports = router;
