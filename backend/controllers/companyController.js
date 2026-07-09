const asyncHandler = require("express-async-handler");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const Plan = require("../models/Plan");
const generateToken = require("../utils/generateToken");

const registerCompany = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    password,
    industry,
    website,
    address,
    city,
    state,
    pincode,
    gstNumber,
    panNumber,
  } = req.body;

  if (await Company.findOne({ email })) {
    res.status(400);
    throw new Error("Company already registered with this email");
  }

  const company = await Company.create({
    name,
    email,
    phone,
    password,
    industry,
    website,
    address,
    city,
    state,
    pincode,
    gstNumber,
    panNumber,
    status: "trial",
  });

  const starterPlan = await Plan.findOne({ planType: "starter" });
  const trialEndDate = new Date();
  trialEndDate.setMonth(trialEndDate.getMonth() + 2);

  const subscription = await Subscription.create({
    company: company._id,
    plan: "starter",
    monthlyPrice: starterPlan.monthlyPrice,
    yearlyPrice: starterPlan.yearlyPrice,
    maxEmployees: starterPlan.maxEmployees,
    billingCycle: "monthly",
    startDate: new Date(),
    renewalDate: trialEndDate,
    trialEndDate,
    isTrial: true,
    status: "active",
    paymentStatus: "completed",
  });

  company.subscription = subscription._id;
  await company.save();

  res.status(201).json({
    success: true,
    data: {
      _id: company._id,
      name: company.name,
      email: company.email,
      phone: company.phone,
      industry: company.industry,
      status: company.status,
      subscription: subscription,
      token: generateToken(company._id),
    },
  });
});

const loginCompany = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const company = await Company.findOne({ email }).populate("subscription");

  if (!company || !(await company.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  company.lastLogin = new Date();
  await company.save();

  res.json({
    success: true,
    data: {
      _id: company._id,
      name: company.name,
      email: company.email,
      phone: company.phone,
      industry: company.industry,
      status: company.status,
      subscription: company.subscription,
      token: generateToken(company._id),
    },
  });
});

const getCompanyDetails = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.company._id).populate(
    "subscription",
  );

  if (!company) {
    res.status(404);
    throw new Error("Company not found");
  }

  res.json({ success: true, data: company });
});

const updateCompanyProfile = asyncHandler(async (req, res) => {
  const { name, phone, website, address, city, state, pincode, logo } =
    req.body;

  const company = await Company.findById(req.company._id);

  if (!company) {
    res.status(404);
    throw new Error("Company not found");
  }

  if (name) company.name = name;
  if (phone) company.phone = phone;
  if (website) company.website = website;
  if (address) company.address = address;
  if (city) company.city = city;
  if (state) company.state = state;
  if (pincode) company.pincode = pincode;
  if (logo) company.logo = logo;

  await company.save();

  res.json({ success: true, data: company });
});

const upgradeSubscription = asyncHandler(async (req, res) => {
  const { planType, billingCycle } = req.body;

  const company = await Company.findById(req.company._id);
  if (!company) {
    res.status(404);
    throw new Error("Company not found");
  }

  const plan = await Plan.findOne({ planType });
  if (!plan) {
    res.status(404);
    throw new Error("Plan not found");
  }

  let oldSubscription = await Subscription.findById(company.subscription);

  const renewalDate = new Date();
  if (billingCycle === "monthly") {
    renewalDate.setMonth(renewalDate.getMonth() + 1);
  } else {
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  }

  if (oldSubscription) {
    oldSubscription.status = "inactive";
    await oldSubscription.save();
  }

  const subscription = await Subscription.create({
    company: company._id,
    plan: planType,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    maxEmployees: plan.maxEmployees,
    billingCycle,
    startDate: new Date(),
    renewalDate,
    status: "active",
    paymentStatus: "pending",
  });

  company.subscription = subscription._id;
  company.status = "active";
  await company.save();

  res.json({
    success: true,
    message: "Subscription upgraded successfully",
    data: subscription,
  });
});

const getPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find({ active: true });

  res.json({
    success: true,
    data: plans,
  });
});

const getSubscriptionDetails = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.company._id);
  if (!company) {
    res.status(404);
    throw new Error("Company not found");
  }

  const subscription = await Subscription.findById(company.subscription);

  if (!subscription) {
    res.status(404);
    throw new Error("Subscription not found");
  }

  res.json({
    success: true,
    data: subscription,
  });
});

const getMyCompany = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ createdBy: req.user._id }).populate(
    "subscription",
  );

  if (!company) {
    return res
      .status(404)
      .json({ success: false, message: "Company not found" });
  }

  res.json({
    success: true,
    data: company,
  });
});

module.exports = {
  registerCompany,
  loginCompany,
  getCompanyDetails,
  updateCompanyProfile,
  upgradeSubscription,
  getPlans,
  getSubscriptionDetails,
  getMyCompany,
};
