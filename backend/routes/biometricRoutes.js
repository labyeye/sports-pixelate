const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { protect, authorize } = require("../middleware/auth");
const {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  regenerateDeviceToken,
  assignNfcCard,
  removeNfcCard,
  registerDevice,
  getDeviceInfo,
  recordBiometric,
  getLogs,
  setDeviceSerial,
  syncPersonToDevice,
  syncAllToDevice,
  removePersonFromDevice,
  getDeviceCommands,
  saveRfidCard,
  saveFaceDescriptor,
  getFaceDescriptors,
  faceAttendance,
  triggerFingerprintEnroll,
  getDeviceEmployees,
  enrollFaceFromDevice,
  triggerFaceEnroll,
  pushFaceTemplateToDevice,
  assignBiometricUserId,
} = require("../controllers/biometricController");

// Rate limiter for unauthenticated device-facing endpoints — prevents token brute-force
const deviceRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: {
    success: false,
    message: "Too many requests from this device, try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", deviceRateLimit, registerDevice);
router.get("/device/:token", deviceRateLimit, getDeviceInfo);
router.post("/record", deviceRateLimit, recordBiometric);
router.get("/device/:token/people", deviceRateLimit, getDeviceEmployees);
router.post("/device-face-enroll", deviceRateLimit, enrollFaceFromDevice);

router.use(protect);

router.get("/locations", getLocations);
router.post("/locations", authorize("super_admin", "hr_manager"), createLocation);
router.put("/locations/:id", authorize("super_admin", "hr_manager"), updateLocation);
router.delete("/locations/:id", authorize("super_admin", "hr_manager"), deleteLocation);

router.get("/devices", getDevices);
router.post("/devices", authorize("super_admin", "hr_manager"), createDevice);
router.put("/devices/:id", authorize("super_admin", "hr_manager"), updateDevice);
router.delete("/devices/:id", authorize("super_admin", "hr_manager"), deleteDevice);
router.post(
  "/devices/:id/regenerate-token",
  authorize("super_admin", "hr_manager"),
  regenerateDeviceToken,
);

router.post("/devices/:id/nfc", authorize("super_admin", "hr_manager"), assignNfcCard);
router.delete(
  "/devices/:id/nfc/:uid",
  authorize("super_admin", "hr_manager"),
  removeNfcCard,
);

router.get("/logs", getLogs);

router.put("/devices/:id/serial", authorize("super_admin", "hr_manager"), setDeviceSerial);
router.post(
  "/devices/:id/sync-person",
  authorize("super_admin", "hr_manager"),
  syncPersonToDevice,
);
router.post(
  "/devices/:id/sync-all",
  authorize("super_admin", "hr_manager"),
  syncAllToDevice,
);
router.delete(
  "/devices/:id/sync-person/:personType/:personId",
  authorize("super_admin", "hr_manager"),
  removePersonFromDevice,
);
router.get("/devices/:id/commands", getDeviceCommands);

router.post(
  "/people/:personType/:id/biometric-id",
  authorize("super_admin", "hr_manager"),
  assignBiometricUserId,
);
router.post(
  "/people/:personType/:id/rfid",
  authorize("super_admin", "hr_manager"),
  saveRfidCard,
);
router.post(
  "/people/:personType/:id/face",
  authorize("super_admin", "hr_manager"),
  saveFaceDescriptor,
);
router.get("/face-descriptors", getFaceDescriptors);
router.post("/face-attendance", faceAttendance);

router.post(
  "/devices/:id/enroll-fingerprint",
  authorize("super_admin", "hr_manager"),
  triggerFingerprintEnroll,
);
router.post(
  "/devices/:id/enroll-face-device",
  authorize("super_admin", "hr_manager"),
  triggerFaceEnroll,
);
router.post(
  "/devices/:id/push-face-template",
  authorize("super_admin", "hr_manager"),
  pushFaceTemplateToDevice,
);

module.exports = router;
