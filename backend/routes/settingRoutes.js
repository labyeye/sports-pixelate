const express = require("express");
const router = express.Router();
const {
  getSettings,
  updateSettings,
  uploadCompanyLogo,
} = require("../controllers/settingController");
const { protect, authorize } = require("../middleware/auth");
const { uploadCompanyLogo: logoMulter } = require("../middleware/upload");

router.use(protect);

router
  .route("/")
  .get(getSettings)
  .put(authorize("super_admin", "admin", "hr_manager"), updateSettings);

router.post(
  "/logo",
  authorize("super_admin", "admin", "hr_manager"),
  (req, res, next) => {
    logoMulter(req, res, (err) => {
      if (err) {
        res.status(400);
        return next(err);
      }
      next();
    });
  },
  uploadCompanyLogo,
);

module.exports = router;
