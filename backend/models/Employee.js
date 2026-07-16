const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employeeId: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    designation: { type: String, required: true },
    role: {
      type: String,
      enum: ["coach", "staff"],
      default: "staff",
    },
    sport: { type: String, default: "" }, // which sport they coach, when role === "coach"
    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "contract", "intern"],
      default: "full_time",
    },
    joinDate: { type: Date, required: false },
    exitDate: { type: Date },
    status: {
      type: String,
      enum: ["active", "inactive", "on_leave", "terminated"],
      default: "active",
    },
    salary: { type: Number, default: 0 },
    bankAccount: { type: String },
    accountHolderName: { type: String },
    ifscCode: { type: String },
    panNumber: { type: String },
    panDoc: { type: String },
    aadharNumber: { type: String },
    aadhaarDoc: { type: String },
    resumeDoc: { type: String }, // uploads/employee-resume/...
    // ── Personal Details ─────────────────────────────────────────────────────
    fatherName: { type: String },
    motherName: { type: String },
    spouseName: { type: String },
    maritalStatus: {
      type: String,
      enum: ["single", "married", "divorced", "widowed"],
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },
    nationality: { type: String, default: "Indian" },
    religion: { type: String },
    personalEmail: { type: String },
    alternatePhone: { type: String },

    // ── Address ───────────────────────────────────────────────────────────────
    address: { type: String }, // current address
    permanentAddress: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },

    emergencyContact: { type: String },
    avatar: { type: String },
    gender: { type: String, enum: ["male", "female", "other"] },
    dateOfBirth: { type: Date },

    // ── Professional Background ───────────────────────────────────────────────
    qualification: { type: String },
    totalExperience: { type: String }, // e.g. "3 years 2 months"
    previousCompany: { type: String },
    reportingTo: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift" },
    shiftName: { type: String, default: "General" },
    isCustomShift: { type: Boolean, default: false },
    customShift: {
      startTime: { type: String },
      endTime: { type: String },
      breakMinutes: { type: Number, default: 30 },
      workingHours: { type: Number, default: 8 },
      otAfterHours: { type: Number, default: 9 },
    },
    pfNumber: { type: String, default: "" },
    esicNumber: { type: String, default: "" },
    uanNumber: { type: String, default: "" },
    bankName: { type: String, default: "" },
    loanBalance: { type: Number, default: 0 },
    advanceBalance: { type: Number, default: 0 },
    otRate: { type: Number, default: 0 },
    otEnabled: { type: Boolean, default: false },
    geofenceAttendanceEnabled: { type: Boolean, default: false },
    geofenceMode: {
      type: String,
      enum: ["specific", "any"],
      default: "specific",
    },
    geofenceLat: { type: Number },
    geofenceLng: { type: Number },
    geofenceRadiusMeters: { type: Number, default: 200 },
    workDaysPerWeek: { type: Number, default: 6 },
    workScheduleType: {
      type: String,
      enum: ["standard", "custom"],
      default: "standard",
    },
    customWorkDays: { type: [Number], default: [] }, // 0=Sun,1=Mon,...,6=Sat
    biometricUserId: { type: String, default: "" },
    rfidCard: { type: String, default: "" },
    faceDescriptor: { type: [Number], default: [] },
    // Raw face template received from ZKTeco/ESSL device (hex string, device-specific binary format)
    deviceFaceTemplate: { type: String, default: "" },
    deviceFaceEnrolledAt: { type: Date },
    // ── ESS Profile Details ──────────────────────────────────────────────────
    nominees: [
      {
        name: { type: String, required: true },
        relationship: { type: String, required: true },
        dateOfBirth: { type: Date },
        percentage: { type: Number, default: 100 },
      },
    ],
    familyDetails: [
      {
        name: { type: String, required: true },
        relationship: { type: String, required: true },
        dateOfBirth: { type: Date },
        phone: { type: String },
      },
    ],
    education: [
      {
        degree: { type: String, required: true },
        school: { type: String, required: true },
        passYear: { type: Number, required: true },
        percentage: { type: Number },
      },
    ],
    experience: [
      {
        company: { type: String, required: true },
        role: { type: String, required: true },
        start: { type: Date, required: true },
        end: { type: Date },
        description: { type: String },
      },
    ],
    skills: { type: [String], default: [] },
    certificates: [
      {
        name: { type: String, required: true },
        issuer: { type: String, required: true },
        date: { type: Date },
        docUrl: { type: String },
      },
    ],
  },
  { timestamps: true },
);

employeeSchema.index({ employeeId: 1, company: 1 }, { unique: true });

module.exports = mongoose.model("Employee", employeeSchema);
