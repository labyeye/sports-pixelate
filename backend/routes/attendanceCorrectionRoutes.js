const express = require("express");
const {
  createRequest,
  getRequests,
  approveRejectRequest,
} = require("../controllers/attendanceCorrectionController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();
const NON_PARENT = [
  "super_admin",
  "hr_manager",
  "hr_executive",
  "department_head",
  "employee",
];

router
  .route("/")
  .get(protect, authorize(...NON_PARENT), getRequests)
  .post(protect, authorize(...NON_PARENT), createRequest);

router.put(
  "/:id/status",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  approveRejectRequest,
);

module.exports = router;
