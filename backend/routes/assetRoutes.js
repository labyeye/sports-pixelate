const express = require("express");
const {
  createAsset,
  getAssets,
  assignAsset,
  returnAsset,
  deleteAsset,
} = require("../controllers/assetController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router
  .route("/")
  .get(protect, getAssets)
  .post(protect, authorize("super_admin", "hr_manager"), createAsset);

router
  .route("/:id")
  .delete(protect, authorize("super_admin", "hr_manager"), deleteAsset);

router.post(
  "/:id/assign",
  protect,
  authorize("super_admin", "hr_manager"),
  assignAsset,
);

router.post("/:id/return", protect, returnAsset); // Employees can return assets assigned to them

module.exports = router;
