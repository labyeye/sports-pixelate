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

router.get("/", protect, getDocuments);
router.post(
  "/",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive", "employee"),
  uploadDocumentVault,
  uploadDocument,
);
router.get("/:id/download", protect, downloadDocument);
router.delete(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager", "employee"),
  deleteDocument,
);

module.exports = router;
