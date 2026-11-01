const express = require("express");
const {
  createAnnouncement,
  getAnnouncements,
  deleteAnnouncement,
  markRead,
  acknowledgeAnnouncement,
  uploadPoster,
} = require("../controllers/announcementController");
const { protect, authorize } = require("../middleware/auth");
const { uploadAnnouncementPoster } = require("../middleware/upload");

const router = express.Router();
const ADMINS = ["super_admin", "hr_manager"];

router
  .route("/")
  .get(protect, getAnnouncements)
  .post(protect, authorize(...ADMINS), createAnnouncement);
router.post(
  "/poster",
  protect,
  authorize(...ADMINS),
  uploadAnnouncementPoster,
  uploadPoster,
);
router.post("/:id/read", protect, markRead);
router.post("/:id/acknowledge", protect, acknowledgeAnnouncement);
router.delete("/:id", protect, authorize(...ADMINS), deleteAnnouncement);

module.exports = router;
