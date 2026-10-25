// Offline checks for sensitive-field encryption (no database).
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const test = require("node:test");
const assert = require("node:assert");
const {
  encryptValue,
  decryptValue,
  isEncrypted,
} = require("../utils/fieldCrypto");
const Employee = require("../models/Employee");
const Student = require("../models/Student");

test("round trip, random IV, plaintext passthrough, tamper safe", () => {
  const a = encryptValue("123456789012");
  const b = encryptValue("123456789012");
  assert.ok(isEncrypted(a));
  assert.notEqual(a, b);
  assert.equal(decryptValue(a), "123456789012");
  assert.equal(decryptValue("legacy plain"), "legacy plain");
  assert.equal(encryptValue(a), a, "never double-encrypts");
  assert.equal(decryptValue(a.slice(0, -4) + "AAAA"), undefined);
  assert.equal(encryptValue(""), "");
});

test("Employee: stored encrypted, read and serialised in clear", () => {
  const e = new Employee({
    firstName: "A",
    lastName: "B",
    bankAccount: "000111222333",
    panNumber: "ABCDE1234F",
    aadharNumber: "123412341234",
    ifscCode: "HDFC0001234",
  });
  for (const f of ["bankAccount", "panNumber", "aadharNumber", "ifscCode"]) {
    assert.ok(
      isEncrypted(e.get(f, null, { getters: false })),
      f + " stored encrypted",
    );
  }
  assert.equal(e.bankAccount, "000111222333");
  const json = JSON.parse(JSON.stringify(e));
  assert.equal(json.panNumber, "ABCDE1234F");
  assert.equal(json.aadharNumber, "123412341234");
  assert.equal(json.id, undefined, "no virtuals leaked into JSON");
});

test("Student: medical notes encrypted at rest", () => {
  const s = new Student({ medicalNotes: "Asthma, carries inhaler" });
  assert.ok(isEncrypted(s.get("medicalNotes", null, { getters: false })));
  assert.equal(
    JSON.parse(JSON.stringify(s)).medicalNotes,
    "Asthma, carries inhaler",
  );
});

test("face templates are masked in JSON but keep their shape", () => {
  const e = new Employee({ firstName: "A", lastName: "B" });
  e.faceDescriptor = Array.from({ length: 128 }, (_, i) => i + 1);
  e.deviceFaceTemplate = "SECRETTEMPLATE";
  const json = JSON.parse(JSON.stringify(e));
  assert.equal(json.faceDescriptor.length, 128);
  assert.ok(json.faceDescriptor.every((n) => n === 0));
  assert.equal(json.deviceFaceTemplate, "enrolled");
  assert.equal(e.faceDescriptor[5], 6, "server-side value untouched");
});
