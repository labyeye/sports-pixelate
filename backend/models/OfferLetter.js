const mongoose = require("mongoose");

const offerLetterSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true },
    forRole: { type: String, default: "All" },
    body: { type: String, default: "" },
    uses: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("OfferLetter", offerLetterSchema);
