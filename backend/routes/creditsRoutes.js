const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const c = require("../controllers/creditsController");

router.use(protect, authorize("super_admin", "hr_manager"));

router.get("/balance", c.getBalance);
router.get("/packs", c.getPacks);
router.get("/ledger", c.getLedger);
router.get("/estimate", c.getEstimate);
router.get("/topups", c.getTopups);
router.post("/topup", c.createTopup);
router.post("/topup/verify", c.verifyTopup);

module.exports = router;
