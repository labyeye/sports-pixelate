const express = require("express");
const {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
} = require("../controllers/sportsPlanController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router
  .route("/")
  .get(protect, getPlans)
  .post(protect, authorize("super_admin", "hr_manager"), createPlan);

router
  .route("/:id")
  .put(protect, authorize("super_admin", "hr_manager"), updatePlan)
  .delete(protect, authorize("super_admin", "hr_manager"), deletePlan);

module.exports = router;
