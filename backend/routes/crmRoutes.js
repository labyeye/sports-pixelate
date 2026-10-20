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
  createCrmCompany,
} = require("../controllers/crmController");

// No JWT here — every handler guards itself with the CRM_API_SECRET
// x-api-key check (see crmController.crmAuth), same pattern as /internal/stats.
router.get("/invoices", getCrmInvoices);
router.post("/companies", createCrmCompany);
router.patch("/companies/:companyId/subscription", updateCrmSubscription);

router.get("/offers", getCrmOffers);
router.get("/offers/:id", getCrmOfferById);
router.post("/offers", createCrmOffer);
router.patch("/offers/:id", updateCrmOffer);
router.delete("/offers/:id", deleteCrmOffer);

const m = require("../controllers/crmManageController");
router.get("/companies/:id", m.getCompany);
router.patch("/companies/:id", m.updateCompany);
router.put("/companies/:id/subscription", m.setSubscription);
router.post("/companies/:id/users", m.createUser);
router.patch("/users/:id", m.updateUser);
router.delete("/users/:id", m.deleteUser);

module.exports = router;
