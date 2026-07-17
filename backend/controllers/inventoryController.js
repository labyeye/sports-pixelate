const asyncHandler = require("express-async-handler");
const InventoryItem = require("../models/InventoryItem");
const InventoryTransaction = require("../models/InventoryTransaction");
const {
  escapeRegex,
  safePagination,
  safeSort,
  validateBody,
} = require("../middleware/validate");

const createSchema = {
  name: { required: true, type: "string", minLength: 1, maxLength: 100 },
  category: { required: true, type: "string" },
};

const INVENTORY_SORT_FIELDS = [
  "name",
  "category",
  "availableQuantity",
  "totalQuantity",
  "unitCost",
  "createdAt",
];

const getItems = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { category, sport, search, lowStock } = req.query;

  const filter = { company: req.user.company };
  if (category) filter.category = category;
  if (sport) filter.sport = sport;
  if (search) {
    filter.name = { $regex: escapeRegex(search.slice(0, 100)), $options: "i" };
  }

  const sort = safeSort(req.query, INVENTORY_SORT_FIELDS, { name: 1 });
  const total = await InventoryItem.countDocuments(filter);
  let items = await InventoryItem.find(filter)
    .populate("assignments.assignedTo", "firstName lastName")
    .sort(sort)
    .skip(skip)
    .limit(limit);

  if (lowStock === "true") {
    items = items.filter(
      (i) => i.trackQuantity && i.availableQuantity <= i.reorderThreshold,
    );
  }

  res.json({
    success: true,
    data: items,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const createItem = [
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const {
      name,
      category,
      sport,
      trackQuantity = true,
      totalQuantity = 0,
      unitCost,
      reorderThreshold,
    } = req.body;

    const item = await InventoryItem.create({
      company: req.user.company,
      name,
      category,
      sport,
      trackQuantity,
      totalQuantity,
      availableQuantity: totalQuantity,
      unitCost,
      reorderThreshold,
    });

    if (totalQuantity > 0) {
      await InventoryTransaction.create({
        company: req.user.company,
        item: item._id,
        type: "purchase",
        quantity: totalQuantity,
        notes: "Initial stock",
        recordedBy: req.user._id,
      });
    }

    res.status(201).json({ success: true, data: item });
  }),
];

const updateItem = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    req.body,
    { new: true, runValidators: true },
  );
  if (!item) {
    res.status(404);
    throw new Error("Item not found");
  }
  res.json({ success: true, data: item });
});

const deleteItem = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!item) {
    res.status(404);
    throw new Error("Item not found");
  }
  res.json({ success: true, message: "Item deleted" });
});

// Item photo — file is saved to disk by the uploadInventoryPhoto middleware.
const uploadItemPhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const photoUrl = `${baseUrl}/uploads/inventory-photos/${req.file.filename}`;
  const item = await InventoryItem.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    { photo: photoUrl },
    { new: true },
  );
  if (!item) {
    res.status(404);
    throw new Error("Item not found");
  }
  res.json({ success: true, photo: photoUrl, data: item });
});

// Records a stock movement (order placed with supplier, purchase received adds
// stock and clears matching on-order qty, consume/damage subtracts, return adds back).
const recordTransaction = asyncHandler(async (req, res) => {
  const { type, quantity, notes } = req.body;
  const qty = Number(quantity);
  if (
    !["order", "purchase", "consume", "damage", "return"].includes(type) ||
    !qty ||
    qty <= 0
  ) {
    res.status(400);
    throw new Error("Valid type and positive quantity are required");
  }

  const item = await InventoryItem.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!item) {
    res.status(404);
    throw new Error("Item not found");
  }

  if (type === "order") {
    item.onOrderQuantity = (item.onOrderQuantity || 0) + qty;
  } else if (type === "purchase" || type === "return") {
    item.totalQuantity += type === "purchase" ? qty : 0;
    item.availableQuantity += qty;
    if (type === "purchase") {
      item.onOrderQuantity = Math.max(0, (item.onOrderQuantity || 0) - qty);
    }
  } else {
    if (item.availableQuantity < qty) {
      res.status(400);
      throw new Error("Not enough stock available");
    }
    item.availableQuantity -= qty;
    if (type === "damage") item.totalQuantity -= qty;
  }
  await item.save();

  const txn = await InventoryTransaction.create({
    company: req.user.company,
    item: item._id,
    type,
    quantity: qty,
    notes,
    recordedBy: req.user._id,
  });

  res.json({ success: true, data: { item, transaction: txn } });
});

// Checks out a non-consumable item (e.g. a racket) to a student or coach.
const assignItem = asyncHandler(async (req, res) => {
  const { assignedTo, assignedToModel, quantity = 1, notes } = req.body;
  if (!["Student", "Employee"].includes(assignedToModel)) {
    res.status(400);
    throw new Error("assignedToModel must be Student or Employee");
  }

  const item = await InventoryItem.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!item) {
    res.status(404);
    throw new Error("Item not found");
  }
  if (item.availableQuantity < quantity) {
    res.status(400);
    throw new Error("Not enough stock available to assign");
  }

  item.availableQuantity -= quantity;
  item.assignments.push({ assignedTo, assignedToModel, quantity, notes });
  await item.save();

  res.json({ success: true, data: item });
});

// Marks an assignment as returned, restoring availability.
const returnAssignment = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!item) {
    res.status(404);
    throw new Error("Item not found");
  }
  const assignment = item.assignments.id(req.params.assignmentId);
  if (!assignment || assignment.returnedAt) {
    res.status(404);
    throw new Error("Active assignment not found");
  }
  assignment.returnedAt = new Date();
  item.availableQuantity += assignment.quantity;
  await item.save();

  res.json({ success: true, data: item });
});

module.exports = {
  getItems,
  createItem,
  updateItem,
  deleteItem,
  uploadItemPhoto,
  recordTransaction,
  assignItem,
  returnAssignment,
};
