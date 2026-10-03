const express = require("express");
const {
  getSalaryHeads,
  createSalaryHead,
  updateSalaryHead,
  deleteSalaryHead,
} = require("../controllers/salaryHeadController");
const { protect, authorize } = require("../middleware/auth");
const owner = authorize("super_admin", "hr_manager");
const router = express.Router();

router.get("/", protect, getSalaryHeads);
router.post("/", protect, owner, createSalaryHead);
router.put("/:id", protect, owner, updateSalaryHead);
router.delete("/:id", protect, owner, deleteSalaryHead);

module.exports = router;
