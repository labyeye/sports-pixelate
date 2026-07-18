const Employee = require("../models/Employee");
const Student = require("../models/Student");

const PERSON_MODELS = { employee: Employee, student: Student };
const PERSON_MODEL_NAMES = { employee: "Employee", student: "Student" };

function personModelFor(personType) {
  const Model = PERSON_MODELS[personType];
  if (!Model) throw new Error(`Invalid personType: ${personType}`);
  return Model;
}

function personModelName(personType) {
  const name = PERSON_MODEL_NAMES[personType];
  if (!name) throw new Error(`Invalid personType: ${personType}`);
  return name;
}

function displayName(person) {
  return `${person.firstName || ""} ${person.lastName || ""}`.trim();
}

// A device's PIN space (biometricUserId) and RFID cards are shared across
// employees and students, so uniqueness must be checked across both
// collections — Mongo can't enforce a cross-collection unique index.
async function isBiometricIdTaken(
  company,
  biometricUserId,
  excludePersonType,
  excludeId,
) {
  for (const [personType, Model] of Object.entries(PERSON_MODELS)) {
    const query = { company, biometricUserId };
    if (personType === excludePersonType) {
      query._id = { $ne: excludeId };
    }
    const found = await Model.findOne(query).select("_id");
    if (found) return true;
  }
  return false;
}

async function isRfidCardTaken(
  company,
  rfidCard,
  excludePersonType,
  excludeId,
) {
  for (const [personType, Model] of Object.entries(PERSON_MODELS)) {
    const query = { company, rfidCard };
    if (personType === excludePersonType) {
      query._id = { $ne: excludeId };
    }
    const found = await Model.findOne(query).select("_id firstName lastName");
    if (found) return found;
  }
  return null;
}

async function findPersonByBiometricId(personType, biometricUserId, company) {
  const Model = personModelFor(personType);
  const filter = { biometricUserId, ...(company ? { company } : {}) };
  if (personType === "employee") filter.status = { $ne: "terminated" };
  if (personType === "student") filter.status = { $ne: "inactive" };
  return Model.findOne(filter);
}

module.exports = {
  PERSON_MODELS,
  personModelFor,
  personModelName,
  displayName,
  isBiometricIdTaken,
  isRfidCardTaken,
  findPersonByBiometricId,
};
