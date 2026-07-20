// Builds a UTC midnight Date for a given calendar day, independent of the
// server process's local timezone. A plain "YYYY-MM-DD" string parses as
// UTC midnight per spec, but `setHours(0,0,0,0)` re-zeroes a Date using the
// server's LOCAL timezone — on a server east of UTC that can roll the
// stored date back to the previous day, so attendance marked "today" from
// an IST device could be stored (and later read back) as yesterday.
function toDateOnly(d) {
  const match = typeof d === "string" && d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, day] = match;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(day)));
  }
  const date = new Date(d);
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

module.exports = { toDateOnly };
