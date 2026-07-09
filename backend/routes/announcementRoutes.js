const express = require("express");
const {
  createAnnouncement,
  getAnnouncements,
  deleteAnnouncement,
} = require("../controllers/announcementController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router
  .route("/")
  .get(protect, getAnnouncements)
  .post(protect, authorize("super_admin", "hr_manager", "hr_executive"), createAnnouncement);

router
  .route("/:id")
  .delete(protect, authorize("super_admin", "hr_manager"), deleteAnnouncement);

module.exports = router;
