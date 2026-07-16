const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const Company = require("../models/Company");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Department = require("../models/Department");
const Student = require("../models/Student");
const InventoryItem = require("../models/InventoryItem");
const InventoryTransaction = require("../models/InventoryTransaction");
const Attendance = require("../models/Attendance");
const StudentAttendance = require("../models/StudentAttendance");
const Facility = require("../models/Facility");
const SportsPlan = require("../models/SportsPlan");
const Booking = require("../models/Booking");
const StudentSubscription = require("../models/StudentSubscription");

const COMPANY_ID = "6a4e67ce70cad7ceeea7fb66";

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const company = await Company.findById(COMPANY_ID);
  if (!company) throw new Error("Company not found: " + COMPANY_ID);
  console.log("Using company:", company.name);

  const superAdmin = await User.findOne({
    company: COMPANY_ID,
    role: "super_admin",
  });

  // ── Departments ────────────────────────────────────────────────────────
  const deptDefs = [
    { name: "Coaching", code: "COACH" },
    { name: "Administration", code: "ADMIN" },
    { name: "Facilities", code: "FAC" },
  ];
  const departments = {};
  for (const d of deptDefs) {
    let dept = await Department.findOne({ company: COMPANY_ID, code: d.code });
    if (!dept) {
      dept = await Department.create({
        company: COMPANY_ID,
        name: d.name,
        code: d.code,
      });
      console.log("Created department:", dept.name);
    }
    departments[d.code] = dept;
  }

  // ── Employees (+ linked Users) ────────────────────────────────────────
  const employeeDefs = [
    {
      first: "Rohan",
      last: "Mehta",
      designation: "Head Coach",
      dept: "COACH",
      sport: "Football",
      salary: 45000,
    },
    {
      first: "Ananya",
      last: "Kapoor",
      designation: "Swim Coach",
      dept: "COACH",
      sport: "Swimming",
      salary: 38000,
    },
    {
      first: "Vikram",
      last: "Singh",
      designation: "Tennis Coach",
      dept: "COACH",
      sport: "Tennis",
      salary: 40000,
    },
    {
      first: "Priya",
      last: "Nair",
      designation: "Front Desk Executive",
      dept: "ADMIN",
      sport: "",
      salary: 22000,
    },
    {
      first: "Karan",
      last: "Malhotra",
      designation: "Accountant",
      dept: "ADMIN",
      sport: "",
      salary: 30000,
    },
    {
      first: "Sanya",
      last: "Verma",
      designation: "Facility Manager",
      dept: "FAC",
      sport: "",
      salary: 28000,
    },
  ];

  const employees = [];
  for (let i = 0; i < employeeDefs.length; i++) {
    const e = employeeDefs[i];
    const email = `${e.first.toLowerCase()}.${e.last.toLowerCase()}@nestsports-demo.com`;
    const employeeId = `EMP-${String(i + 1).padStart(3, "0")}`;

    let existing = await Employee.findOne({ company: COMPANY_ID, employeeId });
    if (existing) {
      employees.push(existing);
      console.log("Employee already exists:", employeeId);
      continue;
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: `${e.first} ${e.last}`,
        email,
        password: "Demo@12345",
        role: "employee",
        phone: `+91 9${String(800000000 + i).slice(0, 9)}`,
        status: "active",
        company: COMPANY_ID,
        department: departments[e.dept]._id,
        employeeId,
      });
    }

    const employee = await Employee.create({
      user: user._id,
      company: COMPANY_ID,
      employeeId,
      firstName: e.first,
      lastName: e.last,
      email,
      phone: user.phone,
      department: departments[e.dept]._id,
      designation: e.designation,
      employmentType: "full_time",
      joinDate: daysAgo(365 - i * 20),
      status: "active",
      salary: e.salary,
      gender: i % 2 === 0 ? "male" : "female",
      city: "Mumbai",
      state: "Maharashtra",
      shiftName: "General",
    });
    console.log(
      "Created employee:",
      employee.employeeId,
      employee.firstName,
      employee.lastName,
    );
    employees.push(employee);
  }

  // ── Students ───────────────────────────────────────────────────────────
  const studentDefs = [
    {
      first: "Aarav",
      last: "Shah",
      sport: "Football",
      batch: "Evening U-14",
      gender: "male",
      coachIdx: 0,
    },
    {
      first: "Diya",
      last: "Iyer",
      sport: "Swimming",
      batch: "Morning U-10",
      gender: "female",
      coachIdx: 1,
    },
    {
      first: "Ishaan",
      last: "Rao",
      sport: "Tennis",
      batch: "Morning U-12",
      gender: "male",
      coachIdx: 2,
    },
    {
      first: "Myra",
      last: "Joshi",
      sport: "Football",
      batch: "Evening U-14",
      gender: "female",
      coachIdx: 0,
    },
    {
      first: "Kabir",
      last: "Chopra",
      sport: "Swimming",
      batch: "Evening U-16",
      gender: "male",
      coachIdx: 1,
    },
    {
      first: "Aisha",
      last: "Khan",
      sport: "Tennis",
      batch: "Morning U-12",
      gender: "female",
      coachIdx: 2,
    },
    {
      first: "Reyansh",
      last: "Gupta",
      sport: "Football",
      batch: "Morning U-10",
      gender: "male",
      coachIdx: 0,
    },
    {
      first: "Saanvi",
      last: "Bhatt",
      sport: "Swimming",
      batch: "Morning U-10",
      gender: "female",
      coachIdx: 1,
    },
  ];

  const students = [];
  for (let i = 0; i < studentDefs.length; i++) {
    const s = studentDefs[i];
    const studentId = `STU-${String(i + 1).padStart(3, "0")}`;
    let existing = await Student.findOne({ company: COMPANY_ID, studentId });
    if (existing) {
      students.push(existing);
      console.log("Student already exists:", studentId);
      continue;
    }
    const student = await Student.create({
      company: COMPANY_ID,
      studentId,
      firstName: s.first,
      lastName: s.last,
      dateOfBirth: new Date(2013 - (i % 5), i % 12, ((i * 3) % 28) + 1),
      gender: s.gender,
      sport: s.sport,
      batch: s.batch,
      coach: employees[s.coachIdx]._id,
      guardians: [
        {
          relation: "father",
          name: `${s.last} Sr.`,
          phone: `+91 9${String(700000000 + i).slice(0, 9)}`,
          email: `${s.first.toLowerCase()}.parent@nestsports-demo.com`,
        },
      ],
      enrollmentDate: daysAgo(180 - i * 10),
      status: "active",
    });
    console.log(
      "Created student:",
      student.studentId,
      student.firstName,
      student.lastName,
    );
    students.push(student);
  }

  // ── Inventory ─────────────────────────────────────────────────────────
  const inventoryDefs = [
    {
      name: "Football",
      category: "equipment",
      sport: "Football",
      qty: 25,
      cost: 800,
      reorder: 5,
    },
    {
      name: "Tennis Racket",
      category: "equipment",
      sport: "Tennis",
      qty: 15,
      cost: 2500,
      reorder: 3,
    },
    {
      name: "Swim Goggles",
      category: "equipment",
      sport: "Swimming",
      qty: 30,
      cost: 350,
      reorder: 8,
    },
    {
      name: "Training Cones (Set of 10)",
      category: "equipment",
      sport: "Football",
      qty: 12,
      cost: 600,
      reorder: 2,
    },
    {
      name: "Team Jersey (Home)",
      category: "apparel",
      sport: "Football",
      qty: 40,
      cost: 550,
      reorder: 10,
    },
    {
      name: "Swim Cap",
      category: "apparel",
      sport: "Swimming",
      qty: 50,
      cost: 120,
      reorder: 10,
    },
    {
      name: "First Aid Kit",
      category: "consumable",
      sport: "",
      qty: 8,
      cost: 900,
      reorder: 2,
    },
    {
      name: "Tennis Balls (Can of 3)",
      category: "consumable",
      sport: "Tennis",
      qty: 20,
      cost: 250,
      reorder: 5,
    },
  ];

  const inventoryItems = [];
  for (const d of inventoryDefs) {
    let item = await InventoryItem.findOne({
      company: COMPANY_ID,
      name: d.name,
    });
    if (!item) {
      item = await InventoryItem.create({
        company: COMPANY_ID,
        name: d.name,
        category: d.category,
        sport: d.sport,
        trackQuantity: true,
        totalQuantity: d.qty,
        availableQuantity: d.qty,
        unitCost: d.cost,
        reorderThreshold: d.reorder,
      });
      console.log("Created inventory item:", item.name);

      await InventoryTransaction.create({
        company: COMPANY_ID,
        item: item._id,
        type: "purchase",
        quantity: d.qty,
        notes: "Initial stock purchase",
        recordedBy: superAdmin ? superAdmin._id : undefined,
      });
    }
    inventoryItems.push(item);
  }

  // Assign a couple of items out to students/employees + consume transactions
  const racket = inventoryItems.find((i) => i.name === "Tennis Racket");
  if (racket && racket.assignments.length === 0) {
    racket.assignments.push({
      assignedTo: students[2]._id,
      assignedToModel: "Student",
      quantity: 1,
      notes: "Assigned for Tennis practice",
    });
    racket.availableQuantity = Math.max(0, racket.availableQuantity - 1);
    await racket.save();
    await InventoryTransaction.create({
      company: COMPANY_ID,
      item: racket._id,
      type: "consume",
      quantity: 1,
      notes: "Checked out to Ishaan Rao",
      recordedBy: superAdmin ? superAdmin._id : undefined,
    });
    console.log("Assigned racket to student");
  }

  const balls = inventoryItems.find(
    (i) => i.name === "Tennis Balls (Can of 3)",
  );
  if (balls) {
    const already = await InventoryTransaction.findOne({
      item: balls._id,
      type: "consume",
    });
    if (!already) {
      balls.availableQuantity = Math.max(0, balls.availableQuantity - 3);
      await balls.save();
      await InventoryTransaction.create({
        company: COMPANY_ID,
        item: balls._id,
        type: "consume",
        quantity: 3,
        notes: "Used during weekend tournament",
        recordedBy: superAdmin ? superAdmin._id : undefined,
      });
      console.log("Recorded consumption of tennis balls");
    }
  }

  // ── Employee Attendance (last 10 days) ──────────────────────────────────
  for (const emp of employees) {
    for (let d = 9; d >= 0; d--) {
      const date = daysAgo(d);
      const day = date.getDay();
      const isWeekend = day === 0;
      const exists = await Attendance.findOne({ employee: emp._id, date });
      if (exists) continue;

      let status = "present";
      if (isWeekend) status = "weekend";
      else if (d === 4) status = "on_leave";
      else if (d === 2) status = Math.random() > 0.7 ? "late" : "present";
      else if (d === 6) status = "absent";

      const checkIn = new Date(date);
      checkIn.setHours(9, status === "late" ? 25 : 0, 0, 0);
      const checkOut = new Date(date);
      checkOut.setHours(18, 0, 0, 0);

      await Attendance.create({
        employee: emp._id,
        date,
        checkIn: ["present", "late", "half_day"].includes(status)
          ? checkIn
          : undefined,
        checkOut: ["present", "late", "half_day"].includes(status)
          ? checkOut
          : undefined,
        status,
        workHours: ["present", "late"].includes(status) ? 8.5 : 0,
        verifyMode: "manual",
        markedBy: superAdmin ? superAdmin._id : undefined,
      });
    }
  }
  console.log("Seeded employee attendance for last 10 days");

  // ── Student Attendance (last 10 days) ──────────────────────────────────
  for (const stu of students) {
    for (let d = 9; d >= 0; d--) {
      const date = daysAgo(d);
      const exists = await StudentAttendance.findOne({
        student: stu._id,
        date,
      });
      if (exists) continue;

      let status = "present";
      if (Math.random() < 0.15) status = "absent";
      else if (Math.random() < 0.05) status = "excused";

      await StudentAttendance.create({
        company: COMPANY_ID,
        student: stu._id,
        date,
        status,
        batch: stu.batch,
        markedBy: superAdmin ? superAdmin._id : undefined,
      });
    }
  }
  console.log("Seeded student attendance for last 10 days");

  // ── Facilities ───────────────────────────────────────────────────────────
  const facilityDefs = [
    {
      name: "Court 1",
      type: "court",
      sport: "Tennis",
      capacity: 4,
      hourlyFee: 500,
    },
    {
      name: "Turf A",
      type: "turf",
      sport: "Football",
      capacity: 22,
      hourlyFee: 1200,
    },
    {
      name: "Pool Lane 1",
      type: "pool",
      sport: "Swimming",
      capacity: 6,
      hourlyFee: 300,
    },
  ];
  const facilities = [];
  for (const f of facilityDefs) {
    let facility = await Facility.findOne({
      company: COMPANY_ID,
      name: f.name,
    });
    if (!facility) {
      facility = await Facility.create({ company: COMPANY_ID, ...f });
      console.log("Created facility:", facility.name);
    }
    facilities.push(facility);
  }

  // ── Bookings (last 7 days + upcoming) ────────────────────────────────────
  const bookingSlots = ["06:00", "07:00", "16:00", "17:00", "18:00"];
  let bookingsCreated = 0;
  for (let d = 6; d >= -3; d--) {
    const date = d >= 0 ? daysAgo(d) : daysFromNow(-d);
    for (let i = 0; i < 2; i++) {
      const idx = d + i + 100; // offset to keep the index positive before modulo
      const facility = facilities[idx % facilities.length];
      const student = students[idx % students.length];
      const startTime = bookingSlots[idx % bookingSlots.length];
      const [h, m] = startTime.split(":").map(Number);
      const endTime = `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

      const exists = await Booking.findOne({
        company: COMPANY_ID,
        facility: facility._id,
        date,
        startTime,
      });
      if (exists) continue;

      await Booking.create({
        company: COMPANY_ID,
        facility: facility._id,
        student: student._id,
        bookedBy: superAdmin ? superAdmin._id : undefined,
        date,
        startTime,
        endTime,
        fee: facility.hourlyFee,
        status: d < 0 ? "confirmed" : "completed",
        paymentStatus: facility.hourlyFee > 0 ? "completed" : "not_required",
      });
      bookingsCreated++;
    }
  }
  console.log(`Seeded ${bookingsCreated} facility bookings`);

  // ── Sports Plans ─────────────────────────────────────────────────────────
  const planDefs = [
    {
      name: "Football - 3x/week",
      sport: "Football",
      sessionsPerWeek: 3,
      monthlyPrice: 2500,
      yearlyPrice: 25000,
    },
    {
      name: "Swimming - Unlimited",
      sport: "Swimming",
      sessionsPerWeek: 0,
      monthlyPrice: 3000,
      yearlyPrice: 30000,
    },
    {
      name: "Tennis - 2x/week",
      sport: "Tennis",
      sessionsPerWeek: 2,
      monthlyPrice: 2800,
      yearlyPrice: 28000,
    },
  ];
  const plans = {};
  for (const p of planDefs) {
    let plan = await SportsPlan.findOne({ company: COMPANY_ID, name: p.name });
    if (!plan) {
      plan = await SportsPlan.create({ company: COMPANY_ID, ...p });
      console.log("Created sports plan:", plan.name);
    }
    plans[p.sport] = plan;
  }

  // ── Student Subscriptions (mix of active, ending soon, and past due) ─────
  // Offsets chosen so the dashboard's "ending within 7 days" alert table has
  // entries to show: some already expired, some due this week, rest healthy.
  const renewalOffsets = [-3, 2, 5, 20, 25, 40, 45, 60];
  let subsCreated = 0;
  for (let i = 0; i < students.length; i++) {
    const stu = students[i];
    const plan = plans[stu.sport];
    if (!plan) continue;

    const exists = await StudentSubscription.findOne({
      student: stu._id,
      plan: plan._id,
    });
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
    });
    subsCreated++;
  }
  console.log(`Seeded ${subsCreated} student subscriptions`);

  console.log("\nDemo data seed complete.");
  console.log(
    `Employees: ${employees.length}, Students: ${students.length}, Inventory items: ${inventoryItems.length}`,
  );
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
