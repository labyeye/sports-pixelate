const mongoose = require("mongoose");

// Sports equipment/gear stock (rackets, balls, nets, uniforms, ...). Tracks
// quantity on hand, and — for non-consumable gear that gets checked out to a
// specific student/coach — an assignment history (same pattern as the HRMS's
// Asset.js, generalized with a quantity instead of one-item-per-record).
const inventoryItemSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ["equipment", "apparel", "consumable", "other"],
      default: "equipment",
    },
    sport: { type: String, default: "" },
    trackQuantity: { type: Boolean, default: true }, // false = non-consumable, single checkout item
    totalQuantity: { type: Number, default: 0 },
    availableQuantity: { type: Number, default: 0 },
    unitCost: { type: Number, default: 0 },
    reorderThreshold: { type: Number, default: 0 },
    assignments: [
      {
        assignedTo: { type: mongoose.Schema.Types.ObjectId, refPath: "assignments.assignedToModel" },
        assignedToModel: { type: String, enum: ["Student", "Employee"] },
        quantity: { type: Number, default: 1 },
        assignedAt: { type: Date, default: Date.now },
        returnedAt: { type: Date },
        notes: { type: String },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("InventoryItem", inventoryItemSchema);
