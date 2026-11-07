const cron = require("node-cron");
const Employee = require("../models/Employee");
const Student = require("../models/Student");
const Company = require("../models/Company");
const CelebrationLog = require("../models/CelebrationLog");
const wa = require("../services/whatsappService");

// Daily 09:00 IST: WhatsApp wishes. Students' birthdays go to the guardian marked "receivesWhatsapp";
// staff get birthday + wedding-anniversary wishes. Templates come from env (see wa.sendCelebration).
async function run(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const month = ist.getUTCMonth() + 1;
  const day = ist.getUTCDate();
  const year = ist.getUTCFullYear();
  const names = {};
  const today = (field) => ({
    [field]: { $ne: null },
    $expr: {
      $and: [
        { $eq: [{ $month: `$${field}` }, month] },
        { $eq: [{ $dayOfMonth: `$${field}` }, day] },
      ],
    },
  });

  // [template kind, log kind, person id, company, phone, first name]
  const todo = [];
  const students = await Student.find({ status: "active", ...today("dateOfBirth") })
    .select("company firstName guardians")
    .lean();
  for (const s of students) {
    const g = (s.guardians || []).find((x) => x.receivesWhatsapp && x.phone);
    if (g) todo.push(["student_birthday", "birthday", s._id, s.company, g.phone, s.firstName]);
  }
  for (const [kind, field] of [
    ["birthday", "dateOfBirth"],
    ["anniversary", "marriageAnniversary"],
  ]) {
    const emps = await Employee.find({
      status: "active",
      phone: { $exists: true, $ne: "" },
      ...today(field),
    })
      .select("company firstName phone")
      .lean();
    for (const e of emps) todo.push([kind, kind, e._id, e.company, e.phone, e.firstName]);
  }

  for (const [tplKind, logKind, id, company, phone, first] of todo) {
    const key = { company, ref: String(id), kind: logKind, year };
    try {
      await CelebrationLog.create(key); // throws 11000 if already sent
    } catch (err) {
      if (err.code === 11000) continue;
      throw err;
    }
    try {
      names[company] ??=
        (await Company.findById(company).select("name").lean())?.name || "us";
      const sent = await wa.sendCelebration(
        tplKind,
        phone,
        [first || "there", names[company]],
        company,
      );
      if (!sent) await CelebrationLog.deleteOne(key); // not sent (gate/credits/no template): allow a retry
    } catch (err) {
      console.error(`[Celebrations] ${tplKind} ${id}:`, err.message);
    }
  }
}

function startCelebrationWishesJob() {
  // 03:30 UTC = 09:00 IST
  cron.schedule(
    "30 3 * * *",
    () => run().catch((e) => console.error("[Celebrations]", e.message)),
    { timezone: "UTC" },
  );
}

module.exports = { startCelebrationWishesJob, run };
