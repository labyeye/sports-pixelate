const asyncHandler = require("express-async-handler");
const SalaryHead = require("../models/SalaryHead");

const DEFAULT_HEADS = [
  {
    name: "Basic Salary",
    type: "Earning",
    calcMethod: "fixed",
    value: 0,
    taxable: true,
    order: 1,
  },
  {
    name: "HRA",
    type: "Earning",
    calcMethod: "percent_of_basic",
    value: 20,
    taxable: false,
    order: 2,
  },
  {
    name: "DA",
    type: "Earning",
    calcMethod: "percent_of_basic",
    value: 5,
    taxable: true,
    order: 3,
  },
  {
    name: "Conveyance Allowance",
    type: "Earning",
    calcMethod: "fixed",
    value: 1600,
    taxable: false,
    order: 4,
  },
  {
    name: "Medical Allowance",
    type: "Earning",
    calcMethod: "fixed",
    value: 1250,
    taxable: false,
    order: 5,
  },
  {
    name: "Overtime",
    type: "Variable",
    calcMethod: "formula",
    value: 0,
    taxable: true,
    order: 6,
  },
  {
    name: "Provident Fund (PF)",
    type: "Deduction",
    calcMethod: "percent_of_basic",
    value: 12,
    taxable: false,
    order: 7,
  },
  {
    name: "ESI",
    type: "Deduction",
    calcMethod: "percent_of_gross",
    value: 0.75,
    taxable: false,
    order: 8,
  },
  {
    name: "TDS",
    type: "Deduction",
    calcMethod: "fixed",
    value: 0,
    taxable: false,
    order: 9,
  },
  {
    name: "Professional Tax",
    type: "Deduction",
    calcMethod: "fixed",
    value: 200,
    taxable: false,
    order: 10,
  },
  {
    name: "Loan EMI",
    type: "Deduction",
    calcMethod: "as_per_loan",
    value: 0,
    taxable: false,
    order: 11,
  },
];

const getSalaryHeads = asyncHandler(async (req, res) => {
  let heads = await SalaryHead.find({ company: req.user.company }).sort({
    order: 1,
  });
  if (heads.length === 0) {
    const created = await SalaryHead.insertMany(
      DEFAULT_HEADS.map((h) => ({ ...h, company: req.user.company })),
    );
    heads = created;
  }
  res.json({ success: true, data: heads });
});

const createSalaryHead = asyncHandler(async (req, res) => {
  const head = await SalaryHead.create({
    ...req.body,
    company: req.user.company,
  });
  res.status(201).json({ success: true, data: head });
});

const updateSalaryHead = asyncHandler(async (req, res) => {
  const head = await SalaryHead.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    req.body,
    { new: true },
  );
  if (!head)
    return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: head });
});

const deleteSalaryHead = asyncHandler(async (req, res) => {
  await SalaryHead.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  res.json({ success: true, message: "Deleted" });
});

module.exports = {
  getSalaryHeads,
  createSalaryHead,
  updateSalaryHead,
  deleteSalaryHead,
};
