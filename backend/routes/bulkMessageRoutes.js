const express = require("express");
const multer = require("multer");
const { protect, authorize } = require("../middleware/auth");
const c = require("../controllers/bulkMessageController");

const router = express.Router();
// document goes straight to Meta (kept in memory, never written to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, f, cb) =>
    ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
      f.mimetype,
    )
      ? cb(null, true)
      : cb(
          new Error("Only PDF, JPG, PNG or WEBP documents are allowed"),
          false,
        ),
}).single("doc");

router.use(protect, authorize("super_admin", "hr_manager"));
router.route("/").get(c.list).post(upload, c.create);
router.get("/:id", c.get);
router.post("/:id/resend", c.resend);

module.exports = router;
