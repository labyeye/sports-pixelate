const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: true,
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
  subscription: { type: Object }, // web push; absent for native (FCM) devices
  fcmToken: { type: String }, // React Native / FCM device token
  platform: { type: String },
  userAgent: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

schema.index({ employee: 1 });
schema.index({ "subscription.endpoint": 1 }, { unique: true, sparse: true });
schema.index({ fcmToken: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("PushSubscription", schema);
