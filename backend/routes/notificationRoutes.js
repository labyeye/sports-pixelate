const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getNotifications,
  markRead,
  markAllRead,
} = require("../controllers/notificationController");

router.get("/", protect, getNotifications);
router.post("/:id/read", protect, markRead);
router.post("/read-all", protect, markAllRead);

module.exports = router;
