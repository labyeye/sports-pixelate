const Setting = require("../models/Setting");
const Employee = require("../models/Employee");

/**
 * Returns the effective shift (startTime/endTime/breakMinutes/workingHours/otAfterHours)
 * for an employee — their custom shift when isCustomShift is set, otherwise the
 * assigned Shift document. Returns null if neither is available.
 *
 * `emp` must have `isCustomShift`, `customShift`, and `shift` (populated) loaded.
 */
function getEffectiveShift(emp) {
  if (!emp) return null;
  if (emp.isCustomShift && emp.customShift?.startTime && emp.customShift?.endTime) {
    return emp.customShift;
  }
  return emp.shift || null;
}

/**
 * Returns the effective checkout time, capped at shift end when OT is not allowed.
 *
 * OT is allowed only when BOTH conditions are true:
 *   1. Global setting: otEnabled = true  (company-wide master switch)
 *   2. Employee flag:  otEnabled = true  (per-employee toggle)
 *
 * If either is false, a punch-out after shift end is capped at shift end time.
 */
async function getEffectiveCheckOut(companyId, employeeId, punchTime) {
  if (!companyId) return punchTime;

  // 1. Check global master switch
  const settings = await Setting.findOne({ company: companyId }).select(
    "otEnabled",
  );
  const globalOtEnabled = settings?.otEnabled !== false; // default true

  // 2. Fetch employee (with shift populated for endTime)
  const emp = await Employee.findById(employeeId)
    .select("otEnabled shift isCustomShift customShift")
    .populate("shift", "endTime");
  const employeeOtEnabled = emp?.otEnabled === true;

  // OT allowed only when both flags are on
  if (globalOtEnabled && employeeOtEnabled) return punchTime;

  // Cap at shift end if employee has a shift assigned
  const shift = getEffectiveShift(emp);
  if (!shift?.endTime) return punchTime;

  const parts = shift.endTime.split(":");
  const endHour = parseInt(parts[0], 10);
  const endMin = parseInt(parts[1] || "0", 10);

  const shiftEnd = new Date(punchTime);
  shiftEnd.setHours(endHour, endMin, 0, 0);

  return punchTime > shiftEnd ? shiftEnd : punchTime;
}

module.exports = { getEffectiveCheckOut, getEffectiveShift };
