const express = require("express");
const {
  getEmployees,
  getEmployee,
  getMyEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  resetEmployeePassword,
  bulkImportEmployees,
  uploadEmployeeDocuments,
  downloadEmployeeDocument,
  enrollEmployeeFace,
  enrollMyFace,
} = require("../controllers/employeeController");
const { protect, authorize } = require("../middleware/auth");
const {
  uploadEmployeeDocs,
  uploadAvatar,
  uploadFaceEnrollPhoto,
} = require("../middleware/upload");
const router = express.Router();

router.get("/me", protect, getMyEmployee);
router.post("/me/face-enroll", protect, uploadFaceEnrollPhoto, enrollMyFace);

router
  .route("/")
  .get(protect, getEmployees)
  .post(
    protect,
    authorize("super_admin", "hr_manager", "hr_executive"),
    createEmployee,
  );
router
  .route("/:id")
  .get(protect, getEmployee)
  .put(
    protect,
    authorize("super_admin", "hr_manager", "hr_executive"),
    updateEmployee,
  )
  .delete(protect, authorize("super_admin", "hr_manager"), deleteEmployee);

router.post(
  "/bulk-import",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  bulkImportEmployees,
);

router.post(
  "/:id/reset-password",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  resetEmployeePassword,
);

router.post(
  "/:id/documents",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  uploadEmployeeDocs,
  uploadEmployeeDocuments,
);

router.post(
  "/:id/avatar",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  uploadAvatar,
  async (req, res) => {
    const Employee = require("../models/Employee");
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
    await Employee.findByIdAndUpdate(req.params.id, { avatar: avatarUrl });
    res.json({ success: true, avatar: avatarUrl });
  },
);

router.post(
  "/:id/face-enroll",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  uploadFaceEnrollPhoto,
  enrollEmployeeFace,
);

router.get(
  "/:id/documents/:type",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  downloadEmployeeDocument,
);

module.exports = router;
