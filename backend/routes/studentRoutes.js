const express = require("express");
const {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  uploadStudentAvatar,
  uploadGuardianPhotoHandler,
  enrollStudentFace,
} = require("../controllers/studentController");
const { protect, authorize } = require("../middleware/auth");
const {
  uploadAvatar,
  uploadGuardianPhoto,
  uploadFaceEnrollPhoto,
} = require("../middleware/upload");
const { validateMongoId } = require("../middleware/validate");
const router = express.Router();

// owner (super_admin/hr_manager) manage the roster; staff (employee/coach) can
// view students; parent can only view their own linked children (scoped in
// the controller via req.user.children).
router
  .route("/")
  .get(protect, getStudents)
  .post(protect, authorize("super_admin", "hr_manager"), createStudent);

router
  .route("/:id")
  .get(protect, getStudent)
  .put(protect, authorize("super_admin", "hr_manager"), updateStudent)
  .delete(protect, authorize("super_admin", "hr_manager"), deleteStudent);

router.post(
  "/:id/avatar",
  protect,
  authorize("super_admin", "hr_manager"),
  validateMongoId("id"),
  uploadAvatar,
  uploadStudentAvatar,
);

router.post(
  "/:id/guardians/:guardianId/photo",
  protect,
  authorize("super_admin", "hr_manager"),
  validateMongoId("id", "guardianId"),
  uploadGuardianPhoto,
  uploadGuardianPhotoHandler,
);

router.post(
  "/:id/face-enroll",
  protect,
  authorize("super_admin", "hr_manager"),
  validateMongoId("id"),
  uploadFaceEnrollPhoto,
  enrollStudentFace,
);

module.exports = router;
