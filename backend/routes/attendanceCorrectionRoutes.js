const express = require("express");
const {
  createRequest,
  getRequests,
  approveRejectRequest,
} = require("../controllers/attendanceCorrectionController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.route("/").get(protect, getRequests).post(protect, createRequest);

router.put(
  "/:id/status",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  approveRejectRequest,
);

module.exports = router;
