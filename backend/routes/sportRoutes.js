const express = require("express");
const {
  getSports,
  createSport,
  updateSport,
  deleteSport,
} = require("../controllers/sportController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router
  .route("/")
  .get(protect, getSports)
  .post(protect, authorize("super_admin", "hr_manager"), createSport);

router
  .route("/:id")
  .put(protect, authorize("super_admin", "hr_manager"), updateSport)
  .delete(protect, authorize("super_admin", "hr_manager"), deleteSport);

module.exports = router;
