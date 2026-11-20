const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const c = require("../controllers/leadController");

const STAFF = ["super_admin", "hr_manager", "employee"];
const OWNER = ["super_admin", "hr_manager"];

router.use(protect, authorize(...STAFF));
router.route("/").get(c.getLeads).post(c.createLead);
router.put("/:id", c.updateLead);
router.patch("/:id/status", c.updateLeadStatus);
router.post("/:id/notes", c.addLeadNote);
router.post("/:id/convert", authorize(...OWNER), c.convertLead);
router.delete("/:id", authorize(...OWNER), c.deleteLead);

module.exports = router;
