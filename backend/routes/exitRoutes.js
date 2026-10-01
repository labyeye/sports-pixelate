const express = require("express");
const {
  getExits,
  getExit,
  initiateExit,
  updateExit,
  completeExit,
  cancelExit,
  reinstate,
} = require("../controllers/exitController");
const { protect, authorize } = require("../middleware/auth");
const { validateMongoId } = require("../middleware/validate");
const router = express.Router();

// Offboarding is an owner/HR action only.
router.use(protect, authorize("super_admin", "hr_manager"));

router.route("/").get(getExits).post(initiateExit);
router
  .route("/:id")
  .get(validateMongoId("id"), getExit)
  .put(validateMongoId("id"), updateExit);
router.post("/:id/complete", validateMongoId("id"), completeExit);
router.post("/:id/cancel", validateMongoId("id"), cancelExit);
router.post("/:id/reinstate", validateMongoId("id"), reinstate);

module.exports = router;
