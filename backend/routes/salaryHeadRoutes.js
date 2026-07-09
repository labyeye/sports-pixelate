const express = require("express");
const {
  getSalaryHeads,
  createSalaryHead,
  updateSalaryHead,
  deleteSalaryHead,
} = require("../controllers/salaryHeadController");
const { protect } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getSalaryHeads);
router.post("/", protect, createSalaryHead);
router.put("/:id", protect, updateSalaryHead);
router.delete("/:id", protect, deleteSalaryHead);

module.exports = router;
