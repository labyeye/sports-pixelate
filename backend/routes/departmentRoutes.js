const express = require("express");
const {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require("../controllers/departmentController");
const { protect, authorize } = require("../middleware/auth");
const { validateMongoId } = require("../middleware/validate");
const router = express.Router();

router
  .route("/")
  .get(protect, getDepartments)
  .post(protect, authorize("super_admin", "hr_manager"), createDepartment);
router
  .route("/:id")
  .get(protect, validateMongoId("id"), getDepartment)
  .put(
    protect,
    authorize("super_admin", "hr_manager"),
    validateMongoId("id"),
    updateDepartment,
  )
  .delete(
    protect,
    authorize("super_admin", "hr_manager"),
    validateMongoId("id"),
    deleteDepartment,
  );

module.exports = router;
