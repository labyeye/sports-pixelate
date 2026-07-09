const mongoose = require("mongoose");

const employeeDocumentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, maxlength: 200 },
    docType: {
      type: String,
      required: true,
      enum: [
        "id_proof",
        "certificate",
        "contract",
        "resume",
        "offer_letter",
        "other",
      ],
    },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    filePath: { type: String, required: true }, // relative path under /uploads/employee-docs/
  },
  { timestamps: true },
);

module.exports = mongoose.model("EmployeeDocument", employeeDocumentSchema);
