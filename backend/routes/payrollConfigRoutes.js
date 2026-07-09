const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getAllConfigs,
  getConfig,
  upsertConfig,
  getDeductionRules,
  upsertDeductionRules,
} = require("../controllers/payrollConfigController");

router.use(protect, authorize("super_admin", "hr_manager"));

router.get("/employee-configs", getAllConfigs);
router.get("/employee-configs/:employeeId", getConfig);
router.put("/employee-configs/:employeeId", upsertConfig);

router.get("/deduction-rules", getDeductionRules);
router.put("/deduction-rules", upsertDeductionRules);

module.exports = router;
