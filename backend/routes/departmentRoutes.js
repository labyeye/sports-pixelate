const express = require("express");
const {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require("../controllers/departmentController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router
  .route("/")
  .get(protect, getDepartments)
  .post(protect, authorize("super_admin", "hr_manager"), createDepartment);
router
  .route("/:id")
  .put(protect, authorize("super_admin", "hr_manager"), updateDepartment)
  .delete(protect, authorize("super_admin", "hr_manager"), deleteDepartment);

module.exports = router;
