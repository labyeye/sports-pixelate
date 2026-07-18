const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getAllConfigs,
  getConfig,
  upsertConfig,
} = require("../controllers/payrollConfigController");

router.use(protect, authorize("super_admin", "hr_manager"));

router.get("/employee-configs", getAllConfigs);
router.get("/employee-configs/:employeeId", getConfig);
router.put("/employee-configs/:employeeId", upsertConfig);

module.exports = router;
