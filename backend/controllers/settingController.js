const asyncHandler = require("express-async-handler");
const { removeStoredUpload } = require("../utils/uploadFiles");
const Setting = require("../models/Setting");
const Company = require("../models/Company");
const { sanitizeIdCardTemplate } = require("../utils/idCardTemplate");
const {
  sanitizeAdmissionFormTemplate,
} = require("../utils/admissionFormTemplate");
const { validateMagicBytes } = require("../middleware/upload");

// Tells the app which gateway secrets are saved (they are never sent back) so it can show "connected".
async function withSecretFlags(setting) {
  if (!setting) return setting;
  const s = await Setting.findOne({ company: setting.company })
    .select("+cashfreeSecretKey +phonepeSaltKey +paytmMerchantKey")
    .lean();
  return {
    ...setting.toJSON(),
    gatewaySecretsSet: {
      cashfree: !!s?.cashfreeSecretKey,
      phonepe: !!s?.phonepeSaltKey,
      paytm: !!s?.paytmMerchantKey,
    },
  };
}

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

  res.json({ success: true, data: await withSecretFlags(setting) });
});

const updateSettings = asyncHandler(async (req, res) => {
  const company = req.user.company;
  const body = { ...req.body };
  // These are select:false and never sent back to the frontend, so a
  // blank/missing value here means "leave it as is", not "clear it".
  const SECRET_FIELDS = [
    "razorpayKeySecret",
    "cashfreeSecretKey",
    "phonepeSaltKey",
    "paytmMerchantKey",
  ];
  for (const field of SECRET_FIELDS) {
    if (!body[field]) delete body[field];
  }

  // Where parents' money goes (gateway keys, bank account, UPI QR) can only be changed by the academy owner —
  // a manager must not be able to point fee payments at their own account.
  const MONEY_FIELDS = [
    "paymentGateway",
    "razorpayKeyId",
    "razorpayKeySecret",
    "cashfreeAppId",
    "cashfreeSecretKey",
    "phonepeMerchantId",
    "phonepeSaltKey",
    "phonepeSaltIndex",
    "paytmMerchantId",
    "paytmMerchantKey",
    "bankAccountName",
    "bankAccountNumber",
    "bankIFSC",
    "bankName",
    "bankBranch",
    "paymentQrUrl",
  ];
  if (req.user.role !== "super_admin") {
    // The apps save the whole settings form, so these are dropped quietly rather than failing the whole save.
    for (const f of MONEY_FIELDS) delete body[f];
  }

  if (body.disabledFeatures !== undefined) {
    body.disabledFeatures = Array.isArray(body.disabledFeatures)
      ? [...new Set(body.disabledFeatures.map(String))]
      : [];
  }

  for (const key of ["idCardTemplate", "studentIdCardTemplate"]) {
    if (key in body) {
      try {
        body[key] = sanitizeIdCardTemplate(body[key]);
      } catch (e) {
        res.status(400);
        throw e;
      }
    }
  }

  if ("admissionFormTemplate" in body) {
    try {
      body.admissionFormTemplate = sanitizeAdmissionFormTemplate(
        body.admissionFormTemplate,
      );
    } catch (e) {
      res.status(400);
      throw e;
    }
  }

  const setting = await Setting.findOneAndUpdate(
    { company },
    { $set: { ...body, company } },
    { new: true, upsert: true, runValidators: true },
  );

  res.json({ success: true, data: await withSecretFlags(setting) });
});

// Checks the academy's own Cashfree keys against Cashfree before a parent ever tries to pay: asking for an order
// that cannot exist answers "order not found" when the keys are valid and 401 when they are not.
const testGateway = asyncHandler(async (req, res) => {
  const s = await Setting.findOne({ company: req.user.company }).select(
    "paymentGateway cashfreeAppId +cashfreeSecretKey",
  );
  if (!s?.cashfreeAppId || !s?.cashfreeSecretKey) {
    res.status(400);
    throw new Error("Save your Cashfree App ID and Secret Key first.");
  }
  const base =
    process.env.CASHFREE_ENV === "production"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";
  let r;
  try {
    r = await fetch(`${base}/orders/nest_connection_check`, {
      headers: {
        "x-client-id": s.cashfreeAppId,
        "x-client-secret": s.cashfreeSecretKey,
        "x-api-version": "2023-08-01",
      },
    });
  } catch {
    res.status(502);
    throw new Error("Could not reach Cashfree. Try again in a moment.");
  }
  if (r.status === 401 || r.status === 403) {
    res.status(400);
    throw new Error(
      "Cashfree rejected these keys. Check the App ID, Secret Key and that they are production keys.",
    );
  }
  res.json({
    success: true,
    message: "Cashfree connected. Parents can now pay online.",
  });
});

const uploadCompanyLogo = (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }
  const logoUrl = `/uploads/company-logos/${req.file.filename}`;
  Setting.findOne({ company: req.user.company })
    .select("logoUrl")
    .then(async (before) => {
      const setting = await Setting.findOneAndUpdate(
        { company: req.user.company },
        { $set: { logoUrl, company: req.user.company } },
        { new: true, upsert: true },
      );
      removeStoredUpload(before?.logoUrl, req.file.path);
      res.json({ success: true, logoUrl, data: setting });
    })
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
  Setting.findOne({ company: req.user.company })
    .select("paymentQrUrl")
    .then(async (before) => {
      const setting = await Setting.findOneAndUpdate(
        { company: req.user.company },
        { $set: { paymentQrUrl, company: req.user.company } },
        { new: true, upsert: true },
      );
      removeStoredUpload(before?.paymentQrUrl, req.file.path);
      res.json({ success: true, paymentQrUrl, data: setting });
    })
    .catch((err) => {
      res.status(500);
      throw err;
    });
};

// An image for an ID-card design (background, logo, badge…). Returns its public URL; the design itself is saved
// through the normal settings update, which only accepts URLs from this folder.
const uploadIdCardImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }
  try {
    await validateMagicBytes(req.file.path); // deletes the file and throws when it isn't a real image
  } catch (err) {
    res.status(400);
    throw err;
  }
  res.json({
    success: true,
    url: `/uploads/id-card-images/${req.file.filename}`,
  });
});

module.exports = {
  uploadIdCardImage,
  getSettings,
  updateSettings,
  testGateway,
  uploadCompanyLogo,
  uploadPaymentQr,
};
