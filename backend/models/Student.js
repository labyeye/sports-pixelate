const mongoose = require("mongoose");

// A parent/guardian's contact details, recorded even when they have no login
// account. Distinct from `parents` below, which links actual User logins.
const guardianSchema = new mongoose.Schema(
  {
    relation: {
      type: String,
      enum: ["father", "mother", "guardian", "other"],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String },
    email: { type: String },
    photo: { type: String },
  },
  { _id: true },
);

const studentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    studentId: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },
    avatar: { type: String },
    sport: { type: String, required: true }, // e.g. "Tennis", "Swimming", "Football"
    batch: { type: String, default: "" }, // e.g. "Morning U-12"
    coach: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    // Guardians who can log in (User.role === "parent") and see this student.
    parents: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // Parent/guardian contact details (name, relation, phone, photo, etc.).
    guardians: [guardianSchema],
    emergencyContact: { type: String },
    medicalNotes: { type: String },
    enrollmentDate: { type: Date, default: Date.now },
    exitDate: { type: Date },
    status: {
      type: String,
      enum: ["active", "inactive", "on_hold"],
      default: "active",
    },
  },
  { timestamps: true },
);

studentSchema.index({ studentId: 1, company: 1 }, { unique: true });

module.exports = mongoose.model("Student", studentSchema);
