const asyncHandler = require("express-async-handler");
const PaymentMethod = require("../models/PaymentMethod");
const Company = require("../models/Company");

const getPaymentMethods = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) {
    return res
      .status(404)
      .json({ success: false, message: "SportsClub not found" });
  }

  const paymentMethods = await PaymentMethod.find({
    company: company._id,
    isActive: true,
  }).sort({ isDefault: -1, createdAt: -1 });

  res.json({ success: true, data: paymentMethods });
});

const addPaymentMethod = asyncHandler(async (req, res) => {
  const {
    type,
    cardNumber,
    cardholderName,
    expiryMonth,
    expiryYear,
    cardBrand,
    upiId,
    accountHolderName,
    accountNumber,
    bankName,
    ifscCode,
    isDefault,
  } = req.body;

  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) {
    return res
      .status(404)
      .json({ success: false, message: "SportsClub not found" });
  }

  if (
    type === "card" &&
    (!cardNumber ||
      !cardholderName ||
      !expiryMonth ||
      !expiryYear ||
      !cardBrand)
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Card details are required" });
  }

  if (type === "upi" && !upiId) {
    return res
      .status(400)
      .json({ success: false, message: "UPI ID is required" });
  }

  if (
    type === "bank_transfer" &&
    (!accountHolderName || !accountNumber || !bankName || !ifscCode)
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Bank account details are required" });
  }

  if (isDefault) {
    await PaymentMethod.updateMany(
      { company: company._id },
      { isDefault: false },
    );
  }

  const paymentMethodData = {
    company: company._id,
    type,
    isDefault: isDefault || false,
    isActive: true,
  };

  if (type === "card") {
    paymentMethodData.cardNumber = cardNumber.slice(-4);
    paymentMethodData.cardholderName = cardholderName;
    paymentMethodData.expiryMonth = expiryMonth;
    paymentMethodData.expiryYear = expiryYear;
    paymentMethodData.cardBrand = cardBrand;
  } else if (type === "upi") {
    paymentMethodData.upiId = upiId;
  } else if (type === "bank_transfer") {
    paymentMethodData.accountHolderName = accountHolderName;
    paymentMethodData.accountNumber = accountNumber.slice(-4);
    paymentMethodData.bankName = bankName;
    paymentMethodData.ifscCode = ifscCode;
  }

  const paymentMethod = await PaymentMethod.create(paymentMethodData);

  res.status(201).json({
    success: true,
    data: paymentMethod,
    message: "Payment method added successfully",
  });
});

const updatePaymentMethod = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isDefault } = req.body;

  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) {
    return res
      .status(404)
      .json({ success: false, message: "SportsClub not found" });
  }

  const paymentMethod = await PaymentMethod.findById(id);
  if (
    !paymentMethod ||
    paymentMethod.company.toString() !== company._id.toString()
  ) {
    return res
      .status(404)
      .json({ success: false, message: "Payment method not found" });
  }

  if (isDefault && !paymentMethod.isDefault) {
    await PaymentMethod.updateMany(
      { company: company._id },
      { isDefault: false },
    );
    paymentMethod.isDefault = true;
  }

  if (typeof req.body.isActive === "boolean") {
    paymentMethod.isActive = req.body.isActive;
  }

  await paymentMethod.save();

  res.json({
    success: true,
    data: paymentMethod,
    message: "Payment method updated",
  });
});

const deletePaymentMethod = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) {
    return res
      .status(404)
      .json({ success: false, message: "SportsClub not found" });
  }

  const paymentMethod = await PaymentMethod.findById(id);
  if (
    !paymentMethod ||
    paymentMethod.company.toString() !== company._id.toString()
  ) {
    return res
      .status(404)
      .json({ success: false, message: "Payment method not found" });
  }

  const activeCount = await PaymentMethod.countDocuments({
    company: company._id,
    isActive: true,
  });
  if (activeCount === 1 && paymentMethod.isActive) {
    return res.status(400).json({
      success: false,
      message: "Cannot delete the only active payment method",
    });
  }

  await PaymentMethod.findByIdAndDelete(id);

  res.json({ success: true, message: "Payment method deleted successfully" });
});

const getDefaultPaymentMethod = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) {
    return res
      .status(404)
      .json({ success: false, message: "SportsClub not found" });
  }

  const defaultMethod = await PaymentMethod.findOne({
    company: company._id,
    isDefault: true,
  });

  res.json({ success: true, data: defaultMethod || null });
});

module.exports = {
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getDefaultPaymentMethod,
};
