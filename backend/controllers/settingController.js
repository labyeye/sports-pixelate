const asyncHandler = require("express-async-handler");
const path = require("path");
const Setting = require("../models/Setting");

const getSettings = asyncHandler(async (req, res) => {
  const company = req.user.company;
  let setting = await Setting.findOne({ company });

  if (!setting) {
    setting = await Setting.create({ company });
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

module.exports = { getSettings, updateSettings, uploadCompanyLogo };
