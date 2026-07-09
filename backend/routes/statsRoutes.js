const express = require("express");
const router = express.Router();
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const Employee = require("../models/Employee");
const User = require("../models/User");
const Invoice = require("../models/Invoice");
const Leave = require("../models/Leave");
const Attendance = require("../models/Attendance");
const Payroll = require("../models/Payroll");

// Simple secret-key guard — no JWT, but not wide-open either.
// Set CRM_API_SECRET in .env. Pass as ?key=<secret> or X-Stats-Key header.
function statsGuard(req, res, next) {
  const secret = process.env.CRM_API_SECRET;
  if (!secret) {
    return res.status(503).json({
      success: false,
      message: "Stats endpoint not configured (CRM_API_SECRET missing)",
    });
  }
  const provided = req.query.key || req.headers["x-stats-key"];
  if (provided !== secret) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
}

router.get("/", statsGuard, async (req, res) => {
  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    // ── 1. Tenant counts ──────────────────────────────────────────────────────
    const [
      totalCompanies,
      activeCompanies,
      trialCompanies,
      inactiveCompanies,
      newLast7Days,
      newLast30Days,
    ] = await Promise.all([
      Company.countDocuments(),
      Company.countDocuments({ status: "active" }),
      Company.countDocuments({ status: "trial" }),
      Company.countDocuments({ status: "inactive" }),
      Company.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Company.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    ]);

    // ── 2. Subscription stats ─────────────────────────────────────────────────
    const [
      totalSubs,
      activeSubs,
      trialSubs,
      cancelledSubs,
      pendingRenewalSubs,
      expiringIn7Days,
      expiringIn30Days,
      expiredSubs,
    ] = await Promise.all([
      Subscription.countDocuments(),
      Subscription.countDocuments({ status: "active", isTrial: false }),
      Subscription.countDocuments({ isTrial: true }),
      Subscription.countDocuments({ status: "cancelled" }),
      Subscription.countDocuments({ status: "pending_renewal" }),
      Subscription.countDocuments({
        status: "active",
        renewalDate: { $gte: now, $lte: in7Days },
      }),
      Subscription.countDocuments({
        status: "active",
        renewalDate: { $gte: now, $lte: in30Days },
      }),
      Subscription.countDocuments({
        renewalDate: { $lt: now },
        status: { $nin: ["cancelled"] },
      }),
    ]);

    // Plan breakdown
    const planBreakdown = await Subscription.aggregate([
      { $match: { status: { $nin: ["cancelled"] } } },
      {
        $group: {
          _id: { plan: "$plan", billingCycle: "$billingCycle" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.plan": 1 } },
    ]);

    // ── 3. Revenue stats ──────────────────────────────────────────────────────
    const revenueAgg = await Invoice.aggregate([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: "$billingCycle",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);
    const revenueByBilling = {};
    for (const r of revenueAgg)
      revenueByBilling[r._id] = { total: r.total, count: r.count };

    const totalRevenue =
      (revenueByBilling.monthly?.total || 0) +
      (revenueByBilling.yearly?.total || 0);

    // MRR: sum of active monthly subscriptions
    const mrrAgg = await Subscription.aggregate([
      { $match: { status: "active", isTrial: false, billingCycle: "monthly" } },
      { $group: { _id: null, mrr: { $sum: "$monthlyPrice" } } },
    ]);
    const mrr = mrrAgg[0]?.mrr || 0;

    // ARR: sum of active yearly subscriptions / 12 + MRR
    const arrAgg = await Subscription.aggregate([
      { $match: { status: "active", isTrial: false, billingCycle: "yearly" } },
      { $group: { _id: null, arr: { $sum: "$yearlyPrice" } } },
    ]);
    const arrFromYearly = arrAgg[0]?.arr || 0;
    const arr = mrr * 12 + arrFromYearly;

    // Revenue last 30 days
    const recentRevenue = await Invoice.aggregate([
      { $match: { status: "paid", paidAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // ── 4. Employee stats ─────────────────────────────────────────────────────
    const [totalEmployees, activeEmployees] = await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ status: "active" }),
    ]);

    const employeesPerCompany = await Employee.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: "$company", count: { $sum: 1 } } },
      {
        $group: {
          _id: null,
          avg: { $avg: "$count" },
          max: { $max: "$count" },
          min: { $min: "$count" },
        },
      },
    ]);

    // ── 5. Activity stats (last 30 days) ──────────────────────────────────────
    const [attendanceLast30, leavesLast30, payrollsLast30] = await Promise.all([
      Attendance.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Leave.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Payroll.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    ]);

    // ── 6. Per-tenant list ────────────────────────────────────────────────────
    const companies = await Company.find()
      .populate("subscription")
      .sort({ createdAt: -1 })
      .select(
        "name email phone industry city state status lastLogin createdAt subscription",
      )
      .lean();

    // Employee count per company (active only)
    const empCountMap = {};
    const empCounts = await Employee.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: "$company", count: { $sum: 1 } } },
    ]);
    for (const e of empCounts) empCountMap[e._id.toString()] = e.count;

    // User (login) count per company
    const userCountMap = {};
    const userCounts = await User.aggregate([
      { $group: { _id: "$company", count: { $sum: 1 } } },
    ]);
    for (const u of userCounts) userCountMap[u._id.toString()] = u.count;

    const tenants = companies.map((c) => {
      const sub = c.subscription;
      const companyId = c._id.toString();
      return {
        id: companyId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        industry: c.industry || null,
        city: c.city || null,
        state: c.state || null,
        status: c.status,
        lastLogin: c.lastLogin || null,
        joinedAt: c.createdAt,
        activeEmployees: empCountMap[companyId] || 0,
        loginUsers: userCountMap[companyId] || 0,
        subscription: sub
          ? {
              plan: sub.plan,
              billingCycle: sub.billingCycle,
              status: sub.status,
              isTrial: sub.isTrial,
              trialEndDate: sub.trialEndDate || null,
              renewalDate: sub.renewalDate,
              maxEmployees: sub.maxEmployees,
              currentEmployeeCount: sub.currentEmployeeCount,
              amountPaid: sub.amountPaid,
              paymentStatus: sub.paymentStatus,
              autoRenew: sub.autoRenew,
              expiringIn7Days:
                sub.renewalDate <= in7Days && sub.renewalDate >= now,
              expiringIn30Days:
                sub.renewalDate <= in30Days && sub.renewalDate >= now,
              isExpired: sub.renewalDate < now && sub.status !== "cancelled",
            }
          : null,
      };
    });

    // ── 7. Expiring soon lists ────────────────────────────────────────────────
    const expiringTenants = tenants.filter(
      (t) => t.subscription?.expiringIn30Days,
    );
    const expiredTenants = tenants.filter((t) => t.subscription?.isExpired);
    const trialTenants = tenants.filter((t) => t.subscription?.isTrial);

    // ── 8. Compose response ───────────────────────────────────────────────────
    res.json({
      success: true,
      generatedAt: now.toISOString(),
      overview: {
        tenants: {
          total: totalCompanies,
          active: activeCompanies,
          trial: trialCompanies,
          inactive: inactiveCompanies,
          newLast7Days,
          newLast30Days,
        },
        subscriptions: {
          total: totalSubs,
          active: activeSubs,
          trial: trialSubs,
          cancelled: cancelledSubs,
          pendingRenewal: pendingRenewalSubs,
          expiringIn7Days,
          expiringIn30Days,
          expired: expiredSubs,
        },
        revenue: {
          totalAllTime: totalRevenue,
          last30Days: recentRevenue[0]?.total || 0,
          mrr,
          arr,
          byBillingCycle: revenueByBilling,
        },
        employees: {
          total: totalEmployees,
          active: activeEmployees,
          avgPerTenant:
            Math.round((employeesPerCompany[0]?.avg || 0) * 10) / 10,
          maxInOneTenant: employeesPerCompany[0]?.max || 0,
        },
        activity: {
          attendanceRecordsLast30Days: attendanceLast30,
          leaveRequestsLast30Days: leavesLast30,
          payrollsProcessedLast30Days: payrollsLast30,
        },
        planBreakdown: planBreakdown.map((p) => ({
          plan: p._id.plan,
          billingCycle: p._id.billingCycle,
          count: p.count,
        })),
      },
      alerts: {
        expiringIn7Days: expiringTenants
          .filter((t) => t.subscription?.expiringIn7Days)
          .map((t) => ({
            name: t.name,
            email: t.email,
            plan: t.subscription?.plan,
            renewalDate: t.subscription?.renewalDate,
          })),
        expiringIn30Days: expiringTenants.map((t) => ({
          name: t.name,
          email: t.email,
          plan: t.subscription?.plan,
          renewalDate: t.subscription?.renewalDate,
        })),
        expired: expiredTenants.map((t) => ({
          name: t.name,
          email: t.email,
          plan: t.subscription?.plan,
          renewalDate: t.subscription?.renewalDate,
          lastLogin: t.lastLogin,
        })),
        trialsActive: trialTenants.map((t) => ({
          name: t.name,
          email: t.email,
          trialEndDate: t.subscription?.trialEndDate,
          activeEmployees: t.activeEmployees,
        })),
      },
      tenants,
    });
  } catch (err) {
    console.error("[Stats] Error:", err.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
