// In-memory 1:N face index for the kiosk scan path. Loading every enrolled
// descriptor from Mongo on each scan costs far more than the comparison
// itself, so descriptors are packed into one Float32Array per company and
// reused. Entries expire after TTL_MS as a backstop for writes that bypass
// document .save() (bulk updates, other server processes); the Employee and
// Student models also call invalidateFaceIndex() when a face or status changes.

const Employee = require("../models/Employee");
const Student = require("../models/Student");
const DeductionRule = require("../models/DeductionRule");

const DIM = 128;
const TTL_MS = parseInt(process.env.FACE_INDEX_TTL_MS || "60000", 10);

// key (company id, or "*" for unscoped) -> { at, promise }
const cache = new Map();

// Students are only recognised once the owner has switched on student face
// attendance. Unscoped lookups (no company) never include students.
async function isStudentFaceEnabled(companyId) {
  if (!companyId) return false;
  const rule = await DeductionRule.findOne({ company: companyId })
    .select("studentFaceAttendanceEnabled")
    .lean();
  return Boolean(rule?.studentFaceAttendanceEnabled);
}

async function loadIndex(companyId) {
  const includeStudents = await isStudentFaceEnabled(companyId);
  const filter = companyId ? { company: companyId } : {};
  const withFace = { faceDescriptor: { $exists: true, $not: { $size: 0 } } };
  const [employees, students] = await Promise.all([
    Employee.find({
      ...filter,
      ...withFace,
      status: { $nin: ["terminated", "exited"] },
    })
      .select("_id faceDescriptor")
      .lean(),
    includeStudents
      ? Student.find({ ...filter, ...withFace, status: { $ne: "inactive" } })
          .select("_id faceDescriptor")
          .lean()
      : [],
  ]);

  const rows = [
    ...employees.map((p) => ({ type: "employee", p })),
    ...students.map((p) => ({ type: "student", p })),
  ].filter((r) => r.p.faceDescriptor.length === DIM);

  const matrix = new Float32Array(rows.length * DIM);
  const ids = new Array(rows.length);
  const types = new Array(rows.length);
  rows.forEach((r, i) => {
    matrix.set(r.p.faceDescriptor, i * DIM);
    ids[i] = r.p._id;
    types[i] = r.type;
  });
  return { matrix, ids, types, size: rows.length };
}

function getIndex(companyId) {
  const key = companyId ? String(companyId) : "*";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;

  const promise = loadIndex(companyId);
  cache.set(key, { at: Date.now(), promise });
  // Don't cache failures.
  promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
  });
  return promise;
}

// Nearest enrolled face to `descriptor`, or null if nobody is enrolled.
// Squared distance with early exit: most candidates are rejected after a few
// dimensions once a decent best has been found.
async function findNearestFace(companyId, descriptor) {
  const { matrix, ids, types, size } = await getIndex(companyId);
  if (!size) return null;

  const probe = Float32Array.from(descriptor);
  let bestSq = Infinity;
  let bestIdx = -1;
  for (let i = 0; i < size; i++) {
    const base = i * DIM;
    let sum = 0;
    let j = 0;
    for (; j < DIM; j++) {
      const d = probe[j] - matrix[base + j];
      sum += d * d;
      if (sum >= bestSq) break;
    }
    if (j === DIM && sum < bestSq) {
      bestSq = sum;
      bestIdx = i;
    }
  }
  if (bestIdx < 0) return null;
  return {
    personType: types[bestIdx],
    personId: ids[bestIdx],
    distance: Math.sqrt(bestSq),
  };
}

function invalidateFaceIndex() {
  cache.clear();
}

// Start loading the index for a company so the first real scan is fast.
function warmFaceIndex(companyId) {
  getIndex(companyId).catch(() => {});
}

module.exports = {
  findNearestFace,
  invalidateFaceIndex,
  warmFaceIndex,
  isStudentFaceEnabled,
};
