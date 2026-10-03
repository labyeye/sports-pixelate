const express = require("express");
const { getMyCompany } = require("../controllers/companyController");
const { protect } = require("../middleware/auth");

const router = express.Router();

// The legacy company-credential flow (register / login / profile / upgrade) was
// removed: it was unauthenticated, unvalidated and could deactivate a paid
// subscription. Owners sign in as users and manage billing via /api/billing.
router.get("/me", protect, getMyCompany);

module.exports = router;
