const express = require("express");
const c = require("../controllers/coachingController");
const { protect, authorize } = require("../middleware/auth");
const { validateMongoId } = require("../middleware/validate");
const router = express.Router();

const OWNER = ["super_admin", "hr_manager"];
const STAFF = [...OWNER, "employee"];

router.get("/schedules", protect, c.getSchedules);
router.post("/schedules", protect, authorize(...OWNER), c.createSchedule);
router
  .route("/schedules/:id")
  .put(protect, authorize(...OWNER), validateMongoId("id"), c.updateSchedule)
  .delete(protect, authorize(...OWNER), validateMongoId("id"), c.deleteSchedule);

router.get("/assessments", protect, c.getAssessments);
router.post("/assessments", protect, authorize(...STAFF), c.createAssessment);
router.delete("/assessments/:id", protect, authorize(...OWNER), validateMongoId("id"), c.deleteAssessment);

module.exports = router;
