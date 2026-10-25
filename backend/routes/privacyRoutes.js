const express = require("express");
const { protect } = require("../middleware/auth");
const {
  exportMyData,
  deleteMyAccount,
} = require("../controllers/privacyController");

const router = express.Router();

router.get("/export", protect, exportMyData);
router.post("/delete-account", protect, deleteMyAccount);

module.exports = router;
