const asyncHandler = require("express-async-handler");
const path = require("path");
const Setting = require("../models/Setting");
const Company = require("../models/Company");

const getSettings = asyncHandler(async (req, res) => {
  const company = req.user.company;
  let setting = await Setting.findOne({ company });

  if (!setting) {
    setting = await Setting.create({ company });
  }

  // Backfill blank club-identity fields from the Company record so details
  // entered at registration/onboarding show up here even if this Setting
  // doc predates that sync, or was created before those fields existed.
  const companyDoc = await Company.findById(company);
  if (companyDoc) {
    const fallbacks = {
      companyName: companyDoc.name,
      companyEmail: companyDoc.email,
      companyPhone: companyDoc.phone,
      companyAddress: companyDoc.address,
      companyWebsite: companyDoc.website,
      companyGST: companyDoc.gstNumber,
      companyPAN: companyDoc.panNumber,
    };
    const updates = {};
    for (const [key, value] of Object.entries(fallbacks)) {
      if (!setting[key] && value) updates[key] = value;
    }
    if (Object.keys(updates).length > 0) {
      setting = await Setting.findOneAndUpdate(
        { company },
        { $set: updates },
        { new: true },
      );
    }
  }

  res.json({ success: true, data: setting });
});

const updateSettings = asyncHandler(async (req, res) => {
  const company = req.user.company;
  const setting = await Setting.findOneAndUpdate(
    { company },
    { $set: { ...req.body, company } },
    { new: true, upsert: true, runValidators: true },
  );

  res.json({ success: true, data: setting });
});

const uploadCompanyLogo = (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }
  const logoUrl = `/uploads/company-logos/${req.file.filename}`;
  Setting.findOneAndUpdate(
    { company: req.user.company },
    { $set: { logoUrl, company: req.user.company } },
    { new: true, upsert: true },
  )
    .then((setting) => res.json({ success: true, logoUrl, data: setting }))
    .catch((err) => {
      res.status(500);
      throw err;
    });
};

const uploadPaymentQr = (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }
  const paymentQrUrl = `/uploads/payment-qr/${req.file.filename}`;
  Setting.findOneAndUpdate(
    { company: req.user.company },
    { $set: { paymentQrUrl, company: req.user.company } },
    { new: true, upsert: true },
  )
    .then((setting) => res.json({ success: true, paymentQrUrl, data: setting }))
    .catch((err) => {
      res.status(500);
      throw err;
    });
};

module.exports = {
  getSettings,
  updateSettings,
  uploadCompanyLogo,
  uploadPaymentQr,
};
