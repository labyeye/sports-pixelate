const Student = require("../models/Student");
const Employee = require("../models/Employee");

// Today's (IST) student birthdays and staff birthdays / work anniversaries as notification-shaped items. Not stored.
async function celebrationsToday(company) {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  const y = ist.getUTCFullYear();
  const on = (dt) => dt && new Date(dt).getUTCMonth() === m && new Date(dt).getUTCDate() === d;
  const [students, staff] = await Promise.all([
    Student.find({ company, status: "active" }).select("firstName lastName dateOfBirth").lean(),
    Employee.find({ company, status: "active" }).select("firstName lastName dateOfBirth joinDate").lean(),
  ]);
  const nm = (x) => `${x.firstName || ""} ${x.lastName || ""}`.trim();
  const item = (id, title, message) => ({ _id: `cel-${id}`, type: "general", title, message, read: false, createdAt: new Date() });
  const out = [];
  for (const s of students)
    if (on(s.dateOfBirth)) out.push(item(`sb-${s._id}`, `🎂 ${nm(s)}`, "Student birthday today"));
  for (const e of staff) {
    if (on(e.dateOfBirth)) out.push(item(`eb-${e._id}`, `🎂 ${nm(e)}`, "Staff birthday today"));
    const yrs = e.joinDate ? y - new Date(e.joinDate).getUTCFullYear() : 0;
    if (on(e.joinDate) && yrs >= 1)
      out.push(item(`ea-${e._id}`, `🎉 ${nm(e)}`, `Work anniversary: ${yrs} year${yrs === 1 ? "" : "s"} with us`));
  }
  return out;
}

module.exports = { celebrationsToday };
