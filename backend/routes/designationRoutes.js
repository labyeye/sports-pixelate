const express = require("express");
const {
  getDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
} = require("../controllers/designationController");
const { protect, authorize } = require("../middleware/auth");
const owner = authorize("super_admin", "hr_manager");
const router = express.Router();

router.get("/", protect, getDesignations);
router.post("/", protect, owner, createDesignation);
router.put("/:id", protect, owner, updateDesignation);
router.delete("/:id", protect, owner, deleteDesignation);

module.exports = router;
