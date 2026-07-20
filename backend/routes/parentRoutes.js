const express = require("express");
const {
  getParents,
  updateParentCredentials,
} = require("../controllers/parentController");
const { protect, authorize } = require("../middleware/auth");
const { validateMongoId } = require("../middleware/validate");
const router = express.Router();

router.get(
  "/",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  getParents,
);

router.post(
  "/:id/credentials",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  validateMongoId("id"),
  updateParentCredentials,
);

module.exports = router;
