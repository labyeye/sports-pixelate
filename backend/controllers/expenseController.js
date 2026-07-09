const asyncHandler = require("express-async-handler");
const Expense = require("../models/Expense");
const { safePagination, validateBody } = require("../middleware/validate");

const createSchema = {
  category: { required: true, type: "string" },
  title: { required: true, type: "string", minLength: 1, maxLength: 120 },
  amount: { required: true, type: "number", min: 0 },
};

const getExpenses = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { category, month, year } = req.query;

  const filter = { company: req.user.company };
  if (category) filter.category = category;
  if (month && year) {
    const m = parseInt(month), y = parseInt(year);
    if (!isNaN(m) && !isNaN(y)) {
      filter.date = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0) };
    }
  }

  const total = await Expense.countDocuments(filter);
  const expenses = await Expense.find(filter)
    .populate("requestedBy", "name")
    .populate("approvedBy", "name")
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  const totalsAgg = await Expense.aggregate([
    { $match: filter },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  res.json({
    success: true,
    data: expenses,
    total,
    totalAmount: totalsAgg[0]?.total || 0,
    page,
    pages: Math.ceil(total / limit),
  });
});

const createExpense = [
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const { category, title, amount, date, description, receiptUrl } = req.body;
    const expense = await Expense.create({
      company: req.user.company,
      category,
      title,
      amount,
      date: date || Date.now(),
      description,
      receiptUrl,
      requestedBy: req.user._id,
      approvedBy: req.user._id,
      status: "approved",
    });
    res.status(201).json({ success: true, data: expense });
  }),
];

const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    req.body,
    { new: true, runValidators: true },
  );
  if (!expense) {
    res.status(404);
    throw new Error("Expense not found");
  }
  res.json({ success: true, data: expense });
});

const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!expense) {
    res.status(404);
    throw new Error("Expense not found");
  }
  res.json({ success: true, message: "Expense deleted" });
});

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };
