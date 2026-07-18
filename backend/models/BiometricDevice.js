const mongoose = require("mongoose");
const crypto = require("crypto");

// A card can be assigned to either an Employee or a Student — `personModel`
// drives the refPath so the same device can enroll both.
const nfcCardSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  personType: {
    type: String,
    enum: ["employee", "student"],
    required: true,
  },
  personModel: {
    type: String,
    enum: ["Employee", "Student"],
    required: true,
  },
  person: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "nfcCards.personModel",
    required: true,
  },
  label: { type: String },
  assignedAt: { type: Date, default: Date.now },
});

const biometricDeviceSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BiometricLocation",
      required: true,
    },
    name: { type: String, required: true, trim: true },

    serialNumber: { type: String, default: "", index: true },

    deviceToken: { type: String, unique: true },

    activationCode: { type: String, unique: true, sparse: true },
    activated: { type: Boolean, default: false },
    activatedAt: { type: Date },
    deviceMeta: {
      model: { type: String, default: "" },
      mac: { type: String, default: "" },
      ip: { type: String, default: "" },
    },
    nfcCards: [nfcCardSchema],
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date },
    attlogStamp: { type: Number, default: 0 },
  },
  { timestamps: true },
);

biometricDeviceSchema.pre("save", function (next) {
  if (!this.deviceToken) {
    this.deviceToken = crypto.randomBytes(32).toString("hex");
  }
  if (!this.activationCode) {
    this.activationCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  }
  next();
});

module.exports = mongoose.model("BiometricDevice", biometricDeviceSchema);
