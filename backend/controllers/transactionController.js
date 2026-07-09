const asyncHandler = require("express-async-handler");
const Transaction = require("../models/Transaction");
const Employee = require("../models/Employee");
const DeductionRule = require("../models/DeductionRule");

const getTransactions = asyncHandler(async (req, res) => {
  const { employee, type } = req.query;
  const filter = { company: req.user.company };
  if (employee) filter.employee = employee;
  if (type) filter.type = type;
  const transactions = await Transaction.find(filter)
    .populate("employee", "firstName lastName employeeId otRate")
    .sort({ date: -1 });
  res.json({ success: true, data: transactions });
});

const createTransaction = asyncHandler(async (req, res) => {
  const { employee, type, amount, hours, date, remark } = req.body;
  if (!employee || !type || !date) {
    res.status(400);
    throw new Error("employee, type and date are required");
  }

  let finalAmount = Number(amount) || 0;
  let finalHours = 0;

  if (type === "overtime") {
    if (!hours || Number(hours) <= 0) {
      res.status(400);
      throw new Error("hours is required for overtime");
    }
    finalHours = Number(hours);

    if (!finalAmount) {
      const emp = await Employee.findById(employee).populate("shift");
      const rule = await DeductionRule.findOne({ company: emp?.company });

      let shiftStartH, shiftStartM, shiftEndH, shiftEndM;
      if (emp?.shift?.startTime) {
        const [sh, sm] = emp.shift.startTime.split(":").map(Number);
        shiftStartH = sh;
        shiftStartM = sm;
      } else {
        shiftStartH = rule?.shiftStartHour ?? 9;
        shiftStartM = rule?.shiftStartMinute ?? 0;
      }
      if (emp?.shift?.endTime) {
        const [eh, em] = emp.shift.endTime.split(":").map(Number);
        shiftEndH = eh;
        shiftEndM = em;
      } else {
        shiftEndH = rule?.shiftEndHour ?? 18;
        shiftEndM = rule?.shiftEndMinute ?? 0;
      }

      const shiftTotalMins =
        shiftEndH * 60 + shiftEndM - (shiftStartH * 60 + shiftStartM);
      const shiftHours = shiftTotalMins > 0 ? shiftTotalMins / 60 : 8;

      const workDaysPerWeek = emp?.workDaysPerWeek ?? 6;
      const now = new Date();
      const y = now.getFullYear(),
        m = now.getMonth() + 1;
      let workingDays = 0;
      const daysInMonth = new Date(y, m, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(y, m - 1, d).getDay();
        if (workDaysPerWeek >= 7) workingDays++;
        else if (workDaysPerWeek >= 6 && dow >= 1 && dow <= 6) workingDays++;
        else if (dow >= 1 && dow <= 5) workingDays++;
      }
      const dailyRate = (emp?.salary ?? 0) / (workingDays || 26);
      const otHourlyRate = dailyRate / shiftHours;
      finalAmount = finalHours * otHourlyRate;
    }
  } else {
    if (!finalAmount) {
      res.status(400);
      throw new Error("amount is required");
    }
  }

  const transaction = await Transaction.create({
    company: req.user.company,
    employee,
    type,
    amount: finalAmount,
    hours: finalHours,
    date: new Date(date),
    remark: remark || "",
  });
  const populated = await Transaction.findById(transaction._id).populate(
    "employee",
    "firstName lastName employeeId otRate",
  );
  res.status(201).json({ success: true, data: populated });
});

const updateTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    req.body,
    { new: true },
  ).populate("employee", "firstName lastName employeeId");
  if (!transaction) {
    res.status(404);
    throw new Error("Transaction not found");
  }
  res.json({ success: true, data: transaction });
});

const deleteTransaction = asyncHandler(async (req, res) => {
  await Transaction.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  res.json({ success: true, message: "Deleted" });
});

module.exports = {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
