const asyncHandler = require("express-async-handler");
const Company = require("../models/Company");

const getMyCompany = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ createdBy: req.user._id }).populate(
    "subscription",
  );

  if (!company) {
    return res
      .status(404)
      .json({ success: false, message: "SportsClub not found" });
  }

  res.json({
    success: true,
    data: company,
  });
});

module.exports = { getMyCompany };
