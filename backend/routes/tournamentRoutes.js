const express = require("express");
const {
  getTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  addTeam,
  removeTeam,
  generateFixtures,
  getFixtures,
  recordResult,
} = require("../controllers/tournamentController");
const { protect, authorize } = require("../middleware/auth");
const { validateMongoId } = require("../middleware/validate");
const router = express.Router();

// Everyone in the academy can browse tournaments/fixtures; only the owner
// (super_admin/hr_manager) manages them — same split as SportsPlan.
router
  .route("/")
  .get(protect, getTournaments)
  .post(protect, authorize("super_admin", "hr_manager"), createTournament);

router
  .route("/:id")
  .get(protect, validateMongoId("id"), getTournament)
  .put(protect, authorize("super_admin", "hr_manager"), validateMongoId("id"), updateTournament)
  .delete(protect, authorize("super_admin", "hr_manager"), validateMongoId("id"), deleteTournament);

router.post(
  "/:id/teams",
  protect,
  authorize("super_admin", "hr_manager"),
  validateMongoId("id"),
  addTeam,
);
router.delete(
  "/:id/teams/:teamId",
  protect,
  authorize("super_admin", "hr_manager"),
  validateMongoId("id", "teamId"),
  removeTeam,
);

router.post(
  "/:id/fixtures/generate",
  protect,
  authorize("super_admin", "hr_manager"),
  validateMongoId("id"),
  generateFixtures,
);
router.get("/:id/fixtures", protect, validateMongoId("id"), getFixtures);
router.put(
  "/fixtures/:fixtureId/result",
  protect,
  authorize("super_admin", "hr_manager"),
  validateMongoId("fixtureId"),
  recordResult,
);

module.exports = router;
