const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true },
    password: { type: String, required: true, minlength: 6 },
    website: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    country: { type: String, default: "India" },
    logo: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive", "trial"],
      default: "trial",
    },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastLogin: { type: Date },
  },
  { timestamps: true },
);

const bcrypt = require("bcryptjs");

companySchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

companySchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("Company", companySchema);
