const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getLateApprovals,
  resolveLateApproval,
} = require("../controllers/lateApprovalController");

router.use(protect, authorize("super_admin", "hr_manager"));

router.get("/", getLateApprovals);
router.post("/:id/resolve", resolveLateApproval);

module.exports = router;
