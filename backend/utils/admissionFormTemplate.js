// Validates and cleans the admission-form design before it is saved on Setting.admissionFormTemplate.
// Shape mirrors frontend/src/lib/admissionForm.ts: 1-5 A4 pages, each a background colour plus positioned elements.
// x / y / w / h are percentages of the page, font sizes are pt. Anything unknown is dropped, numbers are clamped,
// colours are hex only and fonts come from a fixed list, so a stored design can't carry scripts or arbitrary CSS.
const KINDS = [
  "text",
  "field",
  "photo",
  "logo",
  "line",
  "box",
  "image",
  "signature",
];
const FIELDS = [
  "studentName",
  "studentId",
  "dateOfBirth",
  "gender",
  "bloodGroup",
  "sport",
  "batch",
  "coach",
  "enrollmentDate",
  "address",
  "city",
  "state",
  "pincode",
  "fatherName",
  "fatherPhone",
  "motherName",
  "motherPhone",
  "guardianName",
  "guardianPhone",
  "guardianEmail",
  "emergencyPerson",
  "emergencyPhone",
  "medicalNotes",
  "experienceLevel",
  "previousAcademy",
  "todayDate",
  "companyName",
  "companyAddress",
  "companyPhone",
  "companyEmail",
  "companyWebsite",
];
const FONTS = ["sans", "serif", "mono", "verdana", "trebuchet", "palatino"];
const ALIGNS = ["left", "center", "right"];
const IMG_SRC = /^\/uploads\/id-card-images\/[A-Za-z0-9._-]{1,120}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_PAGES = 5;
const MAX_ELEMENTS = 80;
const MAX_JSON = 150000;

const num = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const str = (v, max) => String(v ?? "").slice(0, max);
const color = (v, def) => (HEX.test(String(v)) ? String(v) : def);
const pick = (v, list, def) => (list.includes(v) ? v : def);

function cleanElement(e) {
  if (!e || typeof e !== "object" || !KINDS.includes(e.kind)) return null;
  return {
    id: str(e.id, 40) || Math.random().toString(36).slice(2, 10),
    kind: e.kind,
    x: num(e.x, -20, 120, 0),
    y: num(e.y, -20, 120, 0),
    w: num(e.w, 0.1, 140, 20),
    h: num(e.h, 0.1, 140, 5),
    text: str(e.text, 1500),
    field: pick(e.field, FIELDS, "studentName"),
    prefix: str(e.prefix, 60),
    size: num(e.size, 5, 60, 10),
    color: color(e.color, "#111111"),
    fill: color(e.fill, "#ffffff"),
    filled: !!e.filled,
    borderColor: color(e.borderColor, "#111111"),
    borderWidth: num(e.borderWidth, 0, 3, 0.3), // mm
    src: IMG_SRC.test(String(e.src)) ? String(e.src) : "",
    bold: !!e.bold,
    italic: !!e.italic,
    upper: !!e.upper,
    underline: !!e.underline, // field / text: draw a writing line under it
    align: pick(e.align, ALIGNS, "left"),
    font: pick(e.font, FONTS, "sans"),
    rotate: num(e.rotate, -180, 180, 0),
  };
}

function cleanPage(p) {
  const elements = (Array.isArray(p?.elements) ? p.elements : [])
    .slice(0, MAX_ELEMENTS)
    .map(cleanElement)
    .filter(Boolean);
  return { bg: color(p?.bg, "#ffffff"), elements };
}

/** Returns the cleaned template, or null to clear it. Throws on an unusable payload. */
function sanitizeAdmissionFormTemplate(t) {
  if (t === null || t === undefined) return null;
  if (typeof t !== "object" || Array.isArray(t)) {
    throw new Error("Invalid admission form design");
  }
  const pages = (Array.isArray(t.pages) ? t.pages : [])
    .slice(0, MAX_PAGES)
    .map(cleanPage);
  if (!pages.length) pages.push(cleanPage({}));
  const out = { v: 1, pages };
  if (JSON.stringify(out).length > MAX_JSON) {
    throw new Error("Admission form design is too large");
  }
  return out;
}

module.exports = { sanitizeAdmissionFormTemplate, FIELDS };

if (require.main === module) {
  const assert = require("assert");
  const ok = sanitizeAdmissionFormTemplate({
    pages: [
      {
        bg: "red",
        elements: [
          { kind: "text", text: "<b>x</b>", color: "red;x:y", x: 5 },
          { kind: "evil" },
          { kind: "field", field: "nope", size: 999 },
          { kind: "image", src: "http://evil/x.png" },
        ],
      },
    ],
  });
  assert.strictEqual(ok.pages[0].bg, "#ffffff");
  assert.strictEqual(ok.pages[0].elements.length, 3);
  assert.strictEqual(ok.pages[0].elements[0].color, "#111111");
  assert.strictEqual(ok.pages[0].elements[1].field, "studentName");
  assert.strictEqual(ok.pages[0].elements[1].size, 60);
  assert.strictEqual(ok.pages[0].elements[2].src, "");
  assert.throws(() => sanitizeAdmissionFormTemplate([]));
  console.log("admissionFormTemplate ok");
}
