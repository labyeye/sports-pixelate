const express = require("express");
const {
  getItems,
  createItem,
  updateItem,
  deleteItem,
  uploadItemPhoto,
  recordTransaction,
  assignItem,
  returnAssignment,
} = require("../controllers/inventoryController");
const { protect, authorize } = require("../middleware/auth");
const { uploadInventoryPhoto } = require("../middleware/upload");
const router = express.Router();

const ownerOrStaff = authorize("super_admin", "hr_manager", "employee");
const ownerOnly = authorize("super_admin", "hr_manager");

router
  .route("/")
  .get(protect, ownerOrStaff, getItems)
  .post(protect, ownerOnly, createItem);

router
  .route("/:id")
  .put(protect, ownerOnly, updateItem)
  .delete(protect, ownerOnly, deleteItem);

router.post(
  "/:id/photo",
  protect,
  ownerOnly,
  uploadInventoryPhoto,
  uploadItemPhoto,
);

router.post("/:id/transactions", protect, ownerOrStaff, recordTransaction);
router.post("/:id/assign", protect, ownerOrStaff, assignItem);
router.post(
  "/:id/assignments/:assignmentId/return",
  protect,
  ownerOrStaff,
  returnAssignment,
);

module.exports = router;
