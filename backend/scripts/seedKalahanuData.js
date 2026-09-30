// One-off seed for KALAHANU SPORTS (owner: labh@gmail.com) — adds realistic
// students, coaches, inventory, and expenses on top of whatever already
// exists (idempotent: re-running won't duplicate anything already present).
const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const Company = require("../models/Company");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Department = require("../models/Department");
const Student = require("../models/Student");
const InventoryItem = require("../models/InventoryItem");
const InventoryTransaction = require("../models/InventoryTransaction");
const Expense = require("../models/Expense");
const SportsPlan = require("../models/SportsPlan");
const StudentSubscription = require("../models/StudentSubscription");
const StudentAttendance = require("../models/StudentAttendance");
const Attendance = require("../models/Attendance");

const COMPANY_ID = "6a5db856b0daae85094d13c1"; // KALAHANU SPORTS

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}
function daysFromNow(n) {
  return daysAgo(-n);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const company = await Company.findById(COMPANY_ID);
  if (!company) throw new Error("Company not found: " + COMPANY_ID);
  console.log("Using company:", company.name);

  const owner = await User.findOne({ company: COMPANY_ID, role: "super_admin" });
  let tennisDept = await Department.findOne({ company: COMPANY_ID, code: "SPORT001" });

  // ── Coaches (Employees) ───────────────────────────────────────────────
  const coachDefs = [
    { first: "SURESH", last: "PATEL", designation: "SENIOR COACH", salary: 32000 },
    { first: "MEERA", last: "IYER", designation: "ASSISTANT COACH", salary: 22000 },
    { first: "ANJALI", last: "DESHMUKH", designation: "FRONT DESK EXECUTIVE", salary: 15000 },
  ];
  const coaches = [];
  const existingEmpCount = await Employee.countDocuments({ company: COMPANY_ID });
  for (let i = 0; i < coachDefs.length; i++) {
    const c = coachDefs[i];
    const email = `${c.first.toLowerCase()}.${c.last.toLowerCase()}@kalahanu-demo.com`;
    const employeeId = `EMP${String(existingEmpCount + i + 1).padStart(4, "0")}`;

    let employee = await Employee.findOne({ company: COMPANY_ID, email });
    if (employee) {
      coaches.push(employee);
      console.log("Coach already exists:", employee.firstName);
      continue;
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: `${c.first} ${c.last}`,
        email,
        password: "Demo@12345",
        role: "employee",
        phone: `+91 98${String(10000000 + i).slice(0, 8)}`,
        status: "active",
        company: COMPANY_ID,
      });
    }

    employee = await Employee.create({
      user: user._id,
      company: COMPANY_ID,
      employeeId,
      firstName: c.first,
      lastName: c.last,
      email,
      phone: user.phone,
      department: tennisDept ? tennisDept._id : undefined,
      designation: c.designation,
      role: c.designation.includes("COACH") ? "coach" : "staff",
      sport: c.designation.includes("COACH") ? "TENNIS" : "",
      employmentType: "full_time",
      joinDate: daysAgo(300 - i * 30),
      status: "active",
      salary: c.salary,
      gender: c.first === "MEERA" || c.first === "ANJALI" ? "female" : "male",
      city: "Ahmedabad",
      state: "Gujarat",
      shiftName: "General",
    });
    console.log("Created coach:", employee.firstName, employee.lastName);
    coaches.push(employee);
  }

  const existingCoach = await Employee.findOne({
    company: COMPANY_ID,
    role: "coach",
    firstName: "RAVI",
  });
  const allCoaches = existingCoach ? [existingCoach, ...coaches] : coaches;
  const coachPool = allCoaches.filter((c) => c.role === "coach" || c.designation?.includes("COACH"));
  const coachesForAssign = coachPool.length ? coachPool : allCoaches;

  // ── Students ───────────────────────────────────────────────────────────
  const studentDefs = [
    { first: "ARJUN", last: "SHARMA", gender: "male", batch: "MORNING" },
    { first: "PRIYA", last: "PATEL", gender: "female", batch: "MORNING" },
    { first: "ROHIT", last: "MEHTA", gender: "male", batch: "EVENING" },
    { first: "SNEHA", last: "JOSHI", gender: "female", batch: "EVENING" },
    { first: "KARTIK", last: "DESAI", gender: "male", batch: "MORNING" },
    { first: "ISHITA", last: "SHAH", gender: "female", batch: "MORNING" },
    { first: "ADITYA", last: "VERMA", gender: "male", batch: "EVENING" },
    { first: "NEHA", last: "TRIVEDI", gender: "female", batch: "EVENING" },
    { first: "VIVAAN", last: "RATHOD", gender: "male", batch: "MORNING" },
    { first: "ANANYA", last: "PANDYA", gender: "female", batch: "MORNING" },
    { first: "YASH", last: "CHAUHAN", gender: "male", batch: "EVENING" },
    { first: "RIYA", last: "SOLANKI", gender: "female", batch: "EVENING" },
    { first: "DHRUV", last: "BAROT", gender: "male", batch: "MORNING" },
    { first: "KAVYA", last: "PARMAR", gender: "female", batch: "MORNING" },
  ];

  const existingStudentCount = await Student.countDocuments({ company: COMPANY_ID });
  const students = [];
  for (let i = 0; i < studentDefs.length; i++) {
    const s = studentDefs[i];
    const studentId = `STU${String(existingStudentCount + i + 1).padStart(4, "0")}`;

    const already = await Student.findOne({
      company: COMPANY_ID,
      firstName: s.first,
      lastName: s.last,
    });
    if (already) {
      students.push(already);
      console.log("Student already exists:", s.first);
      continue;
    }

    const coach = coachesForAssign[i % coachesForAssign.length];
    const student = await Student.create({
      company: COMPANY_ID,
      studentId,
      firstName: s.first,
      lastName: s.last,
      dateOfBirth: new Date(2012 - (i % 6), i % 12, ((i * 3) % 28) + 1),
      gender: s.gender,
      sport: "TENNIS",
      batch: s.batch,
      coach: coach ? coach._id : undefined,
      guardians: [
        {
          relation: "father",
          name: `${s.last} SR.`,
          phone: `+91 97${String(10000000 + i).slice(0, 8)}`,
          email: `${s.first.toLowerCase()}.parent@kalahanu-demo.com`,
          receivesWhatsapp: true,
        },
      ],
      enrollmentDate: daysAgo(200 - i * 8),
      status: "active",
    });
    console.log("Created student:", student.firstName, student.lastName);
    students.push(student);
  }

  // ── Sports Plans (add an EVENING plan alongside the existing MORNING) ───
  let morningPlan = await SportsPlan.findOne({ company: COMPANY_ID, name: "MORNING" });
  let eveningPlan = await SportsPlan.findOne({ company: COMPANY_ID, name: "EVENING" });
  if (!eveningPlan) {
    eveningPlan = await SportsPlan.create({
      company: COMPANY_ID,
      name: "EVENING",
      sport: "TENNIS",
      sessionsPerWeek: 4,
      monthlyPrice: 2200,
      yearlyPrice: 22000,
      active: true,
    });
    console.log("Created sports plan: EVENING");
  }

  // ── Student subscriptions ────────────────────────────────────────────
  let subsCreated = 0;
  const renewalOffsets = [-2, 3, 6, 15, 20, 28, 35, 45, 55, 70];
  for (let i = 0; i < students.length; i++) {
    const stu = students[i];
    const plan = stu.batch === "EVENING" ? eveningPlan : morningPlan;
    if (!plan) continue;

    const exists = await StudentSubscription.findOne({ student: stu._id, plan: plan._id });
    if (exists) continue;

    const renewalDate = daysFromNow(renewalOffsets[i % renewalOffsets.length]);
    const startDate = new Date(renewalDate);
    startDate.setMonth(startDate.getMonth() - 1);
    const isPastDue = renewalOffsets[i % renewalOffsets.length] < 0;

    await StudentSubscription.create({
      company: COMPANY_ID,
      student: stu._id,
      plan: plan._id,
      planName: plan.name,
      billingCycle: "monthly",
      amount: plan.monthlyPrice,
      startDate,
      renewalDate,
      status: isPastDue ? "pending_renewal" : "active",
      autoRenew: true,
      paymentStatus: "completed",
      amountPaid: plan.monthlyPrice,
      payments: [
        {
          amount: plan.monthlyPrice,
          method: i % 3 === 0 ? "cash" : "qr",
          status: "verified",
          submittedAt: startDate,
          verifiedAt: startDate,
          verifiedBy: owner ? owner._id : undefined,
        },
      ],
    });
    subsCreated++;
  }
  console.log(`Seeded ${subsCreated} student subscriptions`);

  // ── Inventory ─────────────────────────────────────────────────────────
  const inventoryDefs = [
    { name: "TENNIS RACKET (JUNIOR)", category: "equipment", qty: 20, cost: 1800, reorder: 4 },
    { name: "TENNIS RACKET (SENIOR)", category: "equipment", qty: 15, cost: 3200, reorder: 3 },
    { name: "TENNIS BALLS (CAN OF 3)", category: "consumable", qty: 40, cost: 220, reorder: 10 },
    { name: "BALL BASKET", category: "equipment", qty: 6, cost: 900, reorder: 1 },
    { name: "TENNIS NET", category: "equipment", qty: 3, cost: 4500, reorder: 1 },
    { name: "COURT MARKING TAPE", category: "consumable", qty: 10, cost: 350, reorder: 2 },
    { name: "TEAM T-SHIRT (KALAHANU)", category: "apparel", qty: 35, cost: 400, reorder: 8 },
    { name: "SPORTS CAP", category: "apparel", qty: 30, cost: 180, reorder: 6 },
    { name: "FIRST AID KIT", category: "consumable", qty: 4, cost: 850, reorder: 1 },
    { name: "WATER DISPENSER", category: "other", qty: 2, cost: 3200, reorder: 1 },
  ];
  const inventoryItems = [];
  for (const d of inventoryDefs) {
    let item = await InventoryItem.findOne({ company: COMPANY_ID, name: d.name });
    if (!item) {
      item = await InventoryItem.create({
        company: COMPANY_ID,
        name: d.name,
        category: d.category,
        sport: "TENNIS",
        trackQuantity: true,
        totalQuantity: d.qty,
        availableQuantity: d.qty,
        unitCost: d.cost,
        reorderThreshold: d.reorder,
      });
      await InventoryTransaction.create({
        company: COMPANY_ID,
        item: item._id,
        type: "purchase",
        quantity: d.qty,
        notes: "Initial stock purchase",
        recordedBy: owner ? owner._id : undefined,
      });
      console.log("Created inventory item:", item.name);
    }
    inventoryItems.push(item);
  }

  // A couple of realistic checkouts/consumption
  const juniorRacket = inventoryItems.find((i) => i.name === "TENNIS RACKET (JUNIOR)");
  if (juniorRacket && juniorRacket.assignments.length === 0 && students[0]) {
    juniorRacket.assignments.push({
      assignedTo: students[0]._id,
      assignedToModel: "Student",
      quantity: 1,
      notes: "Assigned for practice",
    });
    juniorRacket.availableQuantity = Math.max(0, juniorRacket.availableQuantity - 1);
    await juniorRacket.save();
    await InventoryTransaction.create({
      company: COMPANY_ID,
      item: juniorRacket._id,
      type: "consume",
      quantity: 1,
      notes: `Checked out to ${students[0].firstName} ${students[0].lastName}`,
      recordedBy: owner ? owner._id : undefined,
    });
  }
  const ballCans = inventoryItems.find((i) => i.name === "TENNIS BALLS (CAN OF 3)");
  if (ballCans) {
    const already = await InventoryTransaction.findOne({ item: ballCans._id, type: "consume" });
    if (!already) {
      ballCans.availableQuantity = Math.max(0, ballCans.availableQuantity - 8);
      await ballCans.save();
      await InventoryTransaction.create({
        company: COMPANY_ID,
        item: ballCans._id,
        type: "consume",
        quantity: 8,
        notes: "Used during weekend coaching sessions",
        recordedBy: owner ? owner._id : undefined,
      });
    }
  }
  console.log(`Seeded ${inventoryItems.length} inventory items`);

  // ── Expenses (last ~60 days, realistic academy costs) ───────────────────
  const expenseDefs = [
    { title: "Court Rent - Monthly", category: "facility_maintenance", amount: 25000, daysAgo: 2 },
    { title: "Electricity Bill", category: "utilities", amount: 4200, daysAgo: 5 },
    { title: "Water Bill", category: "utilities", amount: 900, daysAgo: 5 },
    { title: "Tennis Balls Bulk Purchase", category: "equipment", amount: 8800, daysAgo: 10 },
    { title: "Court Resurfacing & Net Repair", category: "facility_maintenance", amount: 15000, daysAgo: 18 },
    { title: "Coach Salary - Suresh Patel", category: "salaries", amount: 32000, daysAgo: 3 },
    { title: "Coach Salary - Meera Iyer", category: "salaries", amount: 22000, daysAgo: 3 },
    { title: "Front Desk Salary - Anjali Deshmukh", category: "salaries", amount: 15000, daysAgo: 3 },
    { title: "Instagram & Facebook Ads", category: "marketing", amount: 3500, daysAgo: 20 },
    { title: "Banners for Summer Camp", category: "marketing", amount: 2200, daysAgo: 25 },
    { title: "Travel - Inter-Academy Tournament", category: "travel", amount: 6000, daysAgo: 30 },
    { title: "First Aid & Medical Supplies", category: "other", amount: 1200, daysAgo: 12 },
    { title: "Court Rent - Monthly", category: "facility_maintenance", amount: 25000, daysAgo: 32 },
    { title: "Electricity Bill", category: "utilities", amount: 3900, daysAgo: 35 },
    { title: "New Ball Baskets", category: "equipment", amount: 5400, daysAgo: 40 },
    { title: "Team T-Shirts Printing", category: "other", amount: 9800, daysAgo: 45 },
    { title: "Coach Salary - Suresh Patel", category: "salaries", amount: 32000, daysAgo: 33 },
    { title: "Coach Salary - Meera Iyer", category: "salaries", amount: 22000, daysAgo: 33 },
    { title: "Water Dispenser Purchase", category: "other", amount: 3200, daysAgo: 50 },
    { title: "Annual Tournament Sponsorship Banner", category: "marketing", amount: 4500, daysAgo: 55 },
  ];

  let expensesCreated = 0;
  for (const e of expenseDefs) {
    const date = daysAgo(e.daysAgo);
    const exists = await Expense.findOne({ company: COMPANY_ID, title: e.title, date });
    if (exists) continue;
    await Expense.create({
      company: COMPANY_ID,
      category: e.category,
      title: e.title,
      amount: e.amount,
      date,
      description: `${e.title} — recorded for KALAHANU SPORTS`,
      requestedBy: owner ? owner._id : undefined,
      approvedBy: owner ? owner._id : undefined,
      status: "approved",
    });
    expensesCreated++;
  }
  console.log(`Seeded ${expensesCreated} expenses`);

  // ── Attendance history (last 14 days) for realism ───────────────────────
  for (const emp of allCoaches) {
    for (let d = 13; d >= 0; d--) {
      const date = daysAgo(d);
      const day = date.getDay();
      const exists = await Attendance.findOne({ employee: emp._id, date });
      if (exists) continue;
      let status = "present";
      if (day === 0) status = "weekend";
      else if (d === 6) status = "absent";
      else if (d === 9) status = Math.random() > 0.6 ? "late" : "present";

      const checkIn = new Date(date);
      checkIn.setHours(9, status === "late" ? 20 : 0, 0, 0);
      const checkOut = new Date(date);
      checkOut.setHours(18, 0, 0, 0);

      await Attendance.create({
        employee: emp._id,
        date,
        checkIn: ["present", "late"].includes(status) ? checkIn : undefined,
        checkOut: ["present", "late"].includes(status) ? checkOut : undefined,
        status,
        workHours: ["present", "late"].includes(status) ? 9 : 0,
        verifyMode: "manual",
        markedBy: owner ? owner._id : undefined,
      });
    }
  }
  console.log("Seeded coach attendance for last 14 days");

  for (const stu of students) {
    for (let d = 13; d >= 0; d--) {
      const date = daysAgo(d);
      const exists = await StudentAttendance.findOne({ student: stu._id, date });
      if (exists) continue;
      let status = "present";
      if (Math.random() < 0.12) status = "absent";
      else if (Math.random() < 0.05) status = "excused";
      await StudentAttendance.create({
        company: COMPANY_ID,
        student: stu._id,
        date,
        status,
        batch: stu.batch,
        markedBy: owner ? owner._id : undefined,
      });
    }
  }
  console.log("Seeded student attendance for last 14 days");

  console.log("\nSeed complete for KALAHANU SPORTS.");
  console.log(
    `Coaches added: ${coaches.length}, Students added: ${students.length - (existingStudentCount ? 0 : 0)}, Inventory items: ${inventoryItems.length}, Expenses added: ${expensesCreated}`,
  );
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
