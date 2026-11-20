const Student = require("../models/Student");
const StudentSubscription = require("../models/StudentSubscription");
const Setting = require("../models/Setting");

const LIVE = ["active", "pending_renewal", "paused"];
const last10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);

// Applies the club's sibling discount: a student gets it when an
// earlier-enrolled sibling (shared guardian phone or parent login) already
// holds a live subscription — so the first child always pays full price.
function discounted(price, percent) {
  return Math.max(0, Math.round(price * (1 - percent / 100)));
}

async function siblingDiscountPercent(student, companyId) {
  const setting = await Setting.findOne({ company: companyId }).select(
    "siblingDiscountPercent",
  );
  const percent = Number(setting?.siblingDiscountPercent) || 0;
  if (percent <= 0) return 0;

  const phones = (student.guardians || [])
    .map((g) => last10(g.phone))
    .filter((p) => p.length === 10);
  const parents = student.parents || [];
  if (!phones.length && !parents.length) return 0;

  const or = [];
  if (parents.length) or.push({ parents: { $in: parents } });
  if (phones.length)
    or.push({
      guardians: { $elemMatch: { phone: { $regex: `(${phones.join("|")})$` } } },
    });
  const siblings = await Student.find({
    company: companyId,
    _id: { $ne: student._id },
    createdAt: { $lt: student.createdAt || new Date() },
    $or: or,
  }).select("_id");
  if (!siblings.length) return 0;

  const live = await StudentSubscription.exists({
    company: companyId,
    student: { $in: siblings.map((s) => s._id) },
    status: { $in: LIVE },
  });
  return live ? percent : 0;
}

async function priceFor(plan, billingCycle, student, companyId) {
  const base = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const discountPercent = await siblingDiscountPercent(student, companyId);
  return { amount: discounted(base, discountPercent), discountPercent };
}

module.exports = { priceFor, discounted, siblingDiscountPercent };
