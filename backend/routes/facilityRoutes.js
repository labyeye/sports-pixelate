const express = require("express");
const {
  getFacilities,
  createFacility,
  updateFacility,
  deleteFacility,
} = require("../controllers/facilityController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router
  .route("/")
  .get(protect, getFacilities)
  .post(protect, authorize("super_admin", "hr_manager"), createFacility);

router
  .route("/:id")
  .put(protect, authorize("super_admin", "hr_manager"), updateFacility)
  .delete(protect, authorize("super_admin", "hr_manager"), deleteFacility);

module.exports = router;
