const express = require("express");
const {
  uploadDocument,
  getDocuments,
  downloadDocument,
  deleteDocument,
} = require("../controllers/documentController");
const { protect, authorize } = require("../middleware/auth");
const { uploadDocumentVault } = require("../middleware/upload");

const router = express.Router();
const NON_PARENT = [
  "super_admin",
  "hr_manager",
  "hr_executive",
  "department_head",
  "employee",
];

router.get("/", protect, authorize(...NON_PARENT), getDocuments);
router.post(
  "/",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive", "employee"),
  uploadDocumentVault,
  uploadDocument,
);
router.get(
  "/:id/download",
  protect,
  authorize(...NON_PARENT),
  downloadDocument,
);
router.delete(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager", "employee"),
  deleteDocument,
);

module.exports = router;
