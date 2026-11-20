const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const c = require("../controllers/makeupController");

const STAFF = ["super_admin", "hr_manager", "employee"];

router.get("/", protect, authorize(...STAFF, "parent"), c.getMakeups);
router.post("/", protect, authorize(...STAFF), c.createMakeup);
router.put("/:id", protect, authorize(...STAFF), c.updateMakeup);
router.delete("/:id", protect, authorize(...STAFF), c.deleteMakeup);

module.exports = router;
