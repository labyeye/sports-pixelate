const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const { protect } = require("../middleware/auth");
const PushSubscription = require("../models/PushSubscription");

router.get("/vapid-public-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.post(
  "/subscribe",
  protect,
  asyncHandler(async (req, res) => {
    const { subscription, userAgent } = req.body;
    if (!subscription?.endpoint) {
      res.status(400);
      throw new Error("Invalid subscription object");
    }
    await PushSubscription.findOneAndUpdate(
      { "subscription.endpoint": subscription.endpoint },
      {
        employee: req.user._id,
        company: req.user.company,
        subscription,
        userAgent: userAgent || req.headers["user-agent"] || "",
      },
      { upsert: true, new: true },
    );
    res.json({ success: true });
  }),
);

router.delete(
  "/unsubscribe",
  protect,
  asyncHandler(async (req, res) => {
    const { endpoint } = req.body;
    if (endpoint) {
      await PushSubscription.deleteOne({ "subscription.endpoint": endpoint });
    } else {
      await PushSubscription.deleteMany({ employee: req.user._id });
    }
    res.json({ success: true });
  }),
);

// FCM token registration for React Native push notifications
router.post(
  "/fcm-register",
  protect,
  asyncHandler(async (req, res) => {
    const { fcmToken, platform } = req.body;
    if (!fcmToken) {
      res.status(400);
      throw new Error("fcmToken is required");
    }
    await PushSubscription.findOneAndUpdate(
      { fcmToken },
      {
        employee: req.user._id,
        company: req.user.company,
        fcmToken,
        platform: platform || "unknown",
        userAgent: req.headers["user-agent"] || "",
      },
      { upsert: true, new: true },
    );
    res.json({ success: true });
  }),
);

module.exports = router;
