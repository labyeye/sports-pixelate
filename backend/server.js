require("dotenv").config();

const REQUIRED_ENV = ["JWT_SECRET", "MONGO_URI"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[FATAL] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}
if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGINS) {
  console.error("[FATAL] ALLOWED_ORIGINS must be set in production");
  process.exit(1);
}

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const timeout = require("connect-timeout");
const errorHandler = require("./middleware/errorHandler");

connectDB();

const { startAttendanceAutoMarkJob } = require("./jobs/attendanceAutoMark");
startAttendanceAutoMarkJob();

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }),
);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://hrms.pixelatenest.com",
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(timeout("30s"));
app.use(morgan("dev"));
app.use(express.json({ limit: "5mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/internal/stats", require("./routes/statsRoutes"));
app.use("/api/crm", require("./routes/crmRoutes"));

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: "Too many auth attempts, please try again later.",
  },
});

const apiRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 5000 });

app.use("/api/whatsapp-webhook", require("./routes/whatsappWebhookRoutes"));
app.use(
  "/api/hrms/whatsapp-webhook",
  require("./routes/whatsappWebhookRoutes"),
);
app.use("/api/company", require("./routes/companyRoutes"));

app.use("/api/auth", authRateLimit, require("./routes/authRoutes"));
app.use(apiRateLimit);
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/employees", require("./routes/employeeRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/leaves", require("./routes/leaveRoutes"));
app.use("/api/payroll", require("./routes/payrollRoutes"));
app.use("/api/departments", require("./routes/departmentRoutes"));
app.use("/api/settings", require("./routes/settingRoutes"));
app.use("/api/billing", require("./routes/billingRoutes"));
app.use("/api/payment-methods", require("./routes/paymentMethodRoutes"));
app.use("/api/holidays", require("./routes/holidayRoutes"));
app.use("/api/payroll-config", require("./routes/payrollConfigRoutes"));
app.use("/api/loans", require("./routes/loanRoutes"));
app.use("/api/shifts", require("./routes/shiftRoutes"));
app.use("/api/salary-heads", require("./routes/salaryHeadRoutes"));
app.use("/api/designations", require("./routes/designationRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));
app.use("/api/push", require("./routes/pushRoutes"));
app.use("/api/audit", require("./routes/auditRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/support", require("./routes/supportRoutes"));
app.use("/api/documents", require("./routes/documentRoutes"));
app.use("/api/announcements", require("./routes/announcementRoutes"));
app.use(
  "/api/attendance-corrections",
  require("./routes/attendanceCorrectionRoutes"),
);

// NestSports domain routes
app.use("/api/students", require("./routes/studentRoutes"));
app.use("/api/sports", require("./routes/sportRoutes"));
app.use("/api/student-attendance", require("./routes/studentAttendanceRoutes"));
app.use("/api/plans", require("./routes/sportsPlanRoutes"));
app.use("/api/subscriptions", require("./routes/subscriptionRoutes"));
app.use("/api/expenses", require("./routes/expenseRoutes"));
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/facilities", require("./routes/facilityRoutes"));
app.use("/api/bookings", require("./routes/bookingRoutes"));
app.use("/api/tournaments", require("./routes/tournamentRoutes"));

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "NestSports API" }),
);

app.use(errorHandler);

const PORT = process.env.PORT || 5002;
app.listen(PORT, () =>
  console.log(`NestSports server running on port ${PORT}`),
);
