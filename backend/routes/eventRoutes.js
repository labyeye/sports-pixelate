const express = require("express");
const {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventDashboard,
  updateEventImages,
  addTeam,
  removeTeam,
  registerStudent,
  unregisterStudent,
  generateFixtures,
  getFixtures,
  recordResult,
  addOfficial,
  updateOfficial,
  removeOfficial,
  addDocument,
  removeDocument,
} = require("../controllers/eventController");
const {
  listGalleryItems,
  addGalleryItem,
  deleteGalleryItem,
} = require("../controllers/eventGalleryController");
const {
  listAnnouncements,
  createAnnouncement,
} = require("../controllers/eventAnnouncementController");
const { listPayments } = require("../controllers/eventPaymentController");
const { listAttendance } = require("../controllers/eventAttendanceController");
const { protect, authorize } = require("../middleware/auth");
const { validateMongoId } = require("../middleware/validate");
const {
  uploadEventImages,
  uploadEventGalleryPhoto,
  uploadEventDocument,
} = require("../middleware/upload");
const router = express.Router();

const canManage = authorize("super_admin", "hr_manager");

// Everyone in the academy can browse events/fixtures; only the owner
// (super_admin/hr_manager) manages them — same split as SportsPlan.
router
  .route("/")
  .get(protect, getEvents)
  .post(protect, canManage, createEvent);

router
  .route("/:id")
  .get(protect, validateMongoId("id"), getEvent)
  .put(protect, canManage, validateMongoId("id"), updateEvent)
  .delete(protect, canManage, validateMongoId("id"), deleteEvent);

router.get("/:id/dashboard", protect, validateMongoId("id"), getEventDashboard);

router.post(
  "/:id/images",
  protect,
  canManage,
  validateMongoId("id"),
  uploadEventImages,
  updateEventImages,
);

router.post("/:id/teams", protect, canManage, validateMongoId("id"), addTeam);
router.delete(
  "/:id/teams/:teamId",
  protect,
  canManage,
  validateMongoId("id", "teamId"),
  removeTeam,
);

// Any authenticated user can register/unregister a student — the controller
// restricts a parent to their own children.
router.post("/:id/registrations", protect, validateMongoId("id"), registerStudent);
router.delete(
  "/:id/registrations/:studentId",
  protect,
  validateMongoId("id", "studentId"),
  unregisterStudent,
);

router.post(
  "/:id/fixtures/generate",
  protect,
  canManage,
  validateMongoId("id"),
  generateFixtures,
);
router.get("/:id/fixtures", protect, validateMongoId("id"), getFixtures);
router.put(
  "/fixtures/:fixtureId/result",
  protect,
  canManage,
  validateMongoId("fixtureId"),
  recordResult,
);

router.post("/:id/officials", protect, canManage, validateMongoId("id"), addOfficial);
router.put(
  "/:id/officials/:officialId",
  protect,
  canManage,
  validateMongoId("id", "officialId"),
  updateOfficial,
);
router.delete(
  "/:id/officials/:officialId",
  protect,
  canManage,
  validateMongoId("id", "officialId"),
  removeOfficial,
);

router.post(
  "/:id/documents",
  protect,
  canManage,
  validateMongoId("id"),
  uploadEventDocument,
  addDocument,
);
router.delete(
  "/:id/documents/:docId",
  protect,
  canManage,
  validateMongoId("id", "docId"),
  removeDocument,
);

// Shell tabs — Gallery/Announcements support list+create; Payments/
// Attendance are read-only until their subsystems are built out.
router.get("/:id/gallery", protect, validateMongoId("id"), listGalleryItems);
router.post(
  "/:id/gallery",
  protect,
  canManage,
  validateMongoId("id"),
  uploadEventGalleryPhoto,
  addGalleryItem,
);
router.delete(
  "/:id/gallery/:itemId",
  protect,
  canManage,
  validateMongoId("id", "itemId"),
  deleteGalleryItem,
);

router.get("/:id/announcements", protect, validateMongoId("id"), listAnnouncements);
router.post("/:id/announcements", protect, canManage, validateMongoId("id"), createAnnouncement);

router.get("/:id/payments", protect, validateMongoId("id"), listPayments);
router.get("/:id/attendance", protect, validateMongoId("id"), listAttendance);

module.exports = router;
