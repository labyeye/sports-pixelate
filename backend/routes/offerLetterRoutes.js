const express = require("express");
const {
  getOfferLetters,
  createOfferLetter,
  updateOfferLetter,
  deleteOfferLetter,
} = require("../controllers/offerLetterController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get(
  "/",
  protect,
  authorize("super_admin", "hr_manager"),
  getOfferLetters,
);
router.post(
  "/",
  protect,
  authorize("super_admin", "hr_manager"),
  createOfferLetter,
);
router.put(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager"),
  updateOfferLetter,
);
router.delete(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager"),
  deleteOfferLetter,
);

module.exports = router;
