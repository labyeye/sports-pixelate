const express = require("express");
const {
  getDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
} = require("../controllers/designationController");
const { protect } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getDesignations);
router.post("/", protect, createDesignation);
router.put("/:id", protect, updateDesignation);
router.delete("/:id", protect, deleteDesignation);

module.exports = router;
