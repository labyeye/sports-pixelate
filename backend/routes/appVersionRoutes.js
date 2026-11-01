const express = require("express");

const router = express.Router();

// Public: the mobile app calls this on launch to decide whether to nudge
// (latest) or block (min) the user into updating. Bump these env vars when a
// new release goes live on the store.
router.get("/", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    success: true,
    data: {
      latestVersion: process.env.APP_LATEST_VERSION || "1.0",
      minVersion: process.env.APP_MIN_VERSION || "1.0",
      androidUrl: process.env.APP_ANDROID_URL || "",
      iosUrl: process.env.APP_IOS_URL || "",
      message: process.env.APP_UPDATE_MESSAGE || "",
    },
  });
});

module.exports = router;
