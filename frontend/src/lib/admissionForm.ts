// Student admission-form design: plain JSON on Setting.admissionFormTemplate (validated by
// backend/utils/admissionFormTemplate.js). A form is 1-5 A4 pages; each page is a background colour plus
// positioned elements. x / y / w / h are percentages of the page and font sizes are pt, so it prints exactly A4.
// The same renderer (pageHTML) feeds the designer canvas and the print window, so what you design is what prints.
import { escapeHtml } from "@/lib/escapeHtml";

export type AfKind =
  | "text"
  | "field"
  | "photo"
  | "logo"
  | "line"
  | "box"
  | "image"
  | "signature";
export type AfAlign = "left" | "center" | "right";
export type AfFont =
  | "sans"
  | "serif"
  | "mono"
  | "verdana"
  | "trebuchet"
  | "palatino";
export type AfField =
  | "studentName"
  | "studentId"
  | "dateOfBirth"
  | "gender"
  | "bloodGroup"
  | "sport"
  | "batch"
  | "coach"
  | "enrollmentDate"
  | "address"
  | "city"
  | "state"
  | "pincode"
  | "fatherName"
  | "fatherPhone"
  | "motherName"
  | "motherPhone"
  | "guardianName"
  | "guardianPhone"
  | "guardianEmail"
  | "emergencyPerson"
  | "emergencyPhone"
  | "medicalNotes"
  | "experienceLevel"
  | "previousAcademy"
  | "todayDate"
  | "companyName"
  | "companyAddress"
  | "companyPhone"
  | "companyEmail"
  | "companyWebsite";

export interface AfEl {
  id: string;
  kind: AfKind;
  x: number; // % of page width
  y: number; // % of page height
  w: number;
  h: number;
  text: string; // text / signature caption
  field: AfField;
  prefix: string;
  size: number; // pt
  color: string;
  fill: string;
  filled: boolean;
  borderColor: string;
  borderWidth: number; // mm
  src: string;
  bold: boolean;
  italic: boolean;
  upper: boolean;
  underline: boolean;
  align: AfAlign;
  font: AfFont;
  rotate: number;
}
export interface AfPage {
  bg: string;
  elements: AfEl[];
}
export interface AdmissionFormTemplate {
  v: 1;
  pages: AfPage[];
}
export interface AfCompany {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
}

export const A4_W = 210;
export const A4_H = 297;
export const MAX_PAGES = 5;
export const PX_PER_MM = 96 / 25.4;

export const FIELD_OPTIONS: { key: AfField; label: string; group: string }[] = [
  { key: "studentName", label: "Student name", group: "Student" },
  { key: "studentId", label: "Student ID", group: "Student" },
  { key: "dateOfBirth", label: "Date of birth", group: "Student" },
  { key: "gender", label: "Gender", group: "Student" },
  { key: "bloodGroup", label: "Blood group", group: "Student" },
  { key: "sport", label: "Sport", group: "Student" },
  { key: "batch", label: "Batch", group: "Student" },
  { key: "coach", label: "Coach", group: "Student" },
  { key: "enrollmentDate", label: "Admission date", group: "Student" },
  { key: "experienceLevel", label: "Experience level", group: "Student" },
  { key: "previousAcademy", label: "Previous academy", group: "Student" },
  { key: "address", label: "Address (full)", group: "Contact" },
  { key: "city", label: "City", group: "Contact" },
  { key: "state", label: "State", group: "Contact" },
  { key: "pincode", label: "Pincode", group: "Contact" },
  { key: "fatherName", label: "Father's name", group: "Family" },
  { key: "fatherPhone", label: "Father's phone", group: "Family" },
  { key: "motherName", label: "Mother's name", group: "Family" },
  { key: "motherPhone", label: "Mother's phone", group: "Family" },
  { key: "guardianName", label: "Guardian name", group: "Family" },
  { key: "guardianPhone", label: "Guardian phone", group: "Family" },
  { key: "guardianEmail", label: "Guardian email", group: "Family" },
  { key: "emergencyPerson", label: "Emergency contact", group: "Health" },
  { key: "emergencyPhone", label: "Emergency phone", group: "Health" },
  { key: "medicalNotes", label: "Medical notes", group: "Health" },
  { key: "todayDate", label: "Today's date", group: "Other" },
  { key: "companyName", label: "Academy name", group: "Academy" },
  { key: "companyAddress", label: "Academy address", group: "Academy" },
  { key: "companyPhone", label: "Academy phone", group: "Academy" },
  { key: "companyEmail", label: "Academy email", group: "Academy" },
  { key: "companyWebsite", label: "Academy website", group: "Academy" },
];

export const KIND_LABELS: Record<AfKind, string> = {
  text: "Text",
  field: "Student field",
  photo: "Student photo",
  logo: "Academy logo",
  line: "Line",
  box: "Box",
  image: "Image",
  signature: "Signature",
};

export const FONT_STACKS: Record<AfFont, string> = {
  sans: "Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
  verdana: "Verdana, Geneva, sans-serif",
  trebuchet: "'Trebuchet MS', Tahoma, sans-serif",
  palatino: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
};

const fmtDate = (v?: string | Date) =>
  v
    ? new Date(v).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

const guardianOf = (s: any, relation: string) =>
  (s?.guardians || []).find((g: any) => g.relation === relation);

/** The text a field shows for this student (empty when unknown, so a blank form prints a clean writing line). */
export function fieldValue(
  key: AfField,
  s: any,
  company: AfCompany,
): string {
  const a = s?.address || {};
  switch (key) {
    case "studentName":
      return s ? `${s.firstName || ""} ${s.lastName || ""}`.trim() : "";
    case "studentId":
      return s?.studentId || "";
    case "dateOfBirth":
      return fmtDate(s?.dateOfBirth);
    case "gender":
      return s?.gender ? s.gender[0].toUpperCase() + s.gender.slice(1) : "";
    case "bloodGroup":
      return s?.bloodGroup || "";
    case "sport":
      return s?.sport || "";
    case "batch":
      return s?.batch || "";
    case "coach":
      return s?.coach
        ? `${s.coach.firstName || ""} ${s.coach.lastName || ""}`.trim()
        : "";
    case "enrollmentDate":
      return fmtDate(s?.enrollmentDate);
    case "experienceLevel":
      return s?.sportsProfile?.experienceLevel || "";
    case "previousAcademy":
      return s?.sportsProfile?.previousAcademy || "";
    case "address":
      return [a.line1, a.city, a.state, a.pincode, a.country]
        .filter(Boolean)
        .join(", ");
    case "city":
      return a.city || "";
    case "state":
      return a.state || "";
    case "pincode":
      return a.pincode || "";
    case "fatherName":
      return guardianOf(s, "father")?.name || "";
    case "fatherPhone":
      return guardianOf(s, "father")?.phone || "";
    case "motherName":
      return guardianOf(s, "mother")?.name || "";
    case "motherPhone":
      return guardianOf(s, "mother")?.phone || "";
    case "guardianName":
      return (s?.guardians?.[0] || {}).name || "";
    case "guardianPhone":
      return (s?.guardians?.[0] || {}).phone || "";
    case "guardianEmail":
      return (s?.guardians?.[0] || {}).email || "";
    case "emergencyPerson":
      return s?.emergencyContactPerson?.name || "";
    case "emergencyPhone":
      return s?.emergencyContactPerson?.phone || s?.emergencyContact || "";
    case "medicalNotes":
      return s?.medicalNotes || "";
    case "todayDate":
      return fmtDate(new Date());
    case "companyName":
      return company.name;
    case "companyAddress":
      return company.address;
    case "companyPhone":
      return company.phone;
    case "companyEmail":
      return company.email;
    case "companyWebsite":
      return company.website;
  }
}

export const SAMPLE_STUDENT = {
  firstName: "Aarav",
  lastName: "Sharma",
  studentId: "STU0001",
  dateOfBirth: "2012-08-12",
  gender: "male",
  bloodGroup: "B+",
  sport: "Cricket",
  batch: "Morning U-14",
  coach: { firstName: "Rohit", lastName: "Verma" },
  enrollmentDate: new Date().toISOString(),
  address: { line1: "12 MG Road", city: "Pune", state: "Maharashtra", pincode: "411001" },
  guardians: [
    { relation: "father", name: "Vikram Sharma", phone: "98765 43210", email: "vikram@example.com" },
    { relation: "mother", name: "Neha Sharma", phone: "98765 43211" },
  ],
  emergencyContactPerson: { name: "Vikram Sharma", phone: "98765 43210" },
  sportsProfile: { experienceLevel: "Beginner", previousAcademy: "—" },
};

let n = 0;
export const newId = () => `a${Date.now().toString(36)}${(n++).toString(36)}`;

export const pctX = (mm: number) => (mm / A4_W) * 100;
export const pctY = (mm: number) => (mm / A4_H) * 100;
export const toMmX = (p: number) => (p / 100) * A4_W;
export const toMmY = (p: number) => (p / 100) * A4_H;

/** Builds an element from millimetre geometry (easier to author than percentages). */
export function makeEl(
  kind: AfKind,
  mm: { x: number; y: number; w: number; h: number },
  over: Partial<AfEl> = {},
): AfEl {
  const base: AfEl = {
    id: newId(),
    kind,
    x: pctX(mm.x),
    y: pctY(mm.y),
    w: pctX(mm.w),
    h: pctY(mm.h),
    text: kind === "text" ? "Text" : kind === "signature" ? "Signature" : "",
    field: "studentName",
    prefix: "",
    size: 10,
    color: "#111111",
    fill: "#eef2ff",
    filled: false,
    borderColor: "#111111",
    borderWidth: kind === "line" || kind === "signature" ? 0.3 : 0.3,
    src: "",
    bold: false,
    italic: false,
    upper: false,
    underline: false,
    align: kind === "signature" ? "center" : "left",
    font: "sans",
    rotate: 0,
  };
  return { ...base, ...over };
}

export const blankPage = (): AfPage => ({ bg: "#ffffff", elements: [] });

const label = (text: string, x: number, y: number, w = 40) =>
  makeEl("text", { x, y, w, h: 6 }, { text, size: 9.5, bold: true, color: "#334155" });
const row = (text: string, field: AfField, x: number, y: number, w: number, lw = 34) => [
  label(text, x, y, lw),
  makeEl("field", { x: x + lw, y, w: w - lw, h: 6 }, { field, size: 10, underline: true, borderColor: "#94a3b8" }),
];
const heading = (text: string, y: number) =>
  makeEl("text", { x: 15, y, w: 180, h: 7 }, {
    text,
    size: 11,
    bold: true,
    upper: true,
    color: "#ffffff",
    fill: "#044bab",
    filled: true,
  });

/** A sensible starting point: page 1 student details, page 2 guardian, declaration and signatures. */
export function defaultTemplate(): AdmissionFormTemplate {
  const p1: AfEl[] = [
    makeEl("logo", { x: 15, y: 12, w: 24, h: 24 }),
    makeEl("field", { x: 44, y: 13, w: 110, h: 9 }, { field: "companyName", size: 18, bold: true, color: "#044bab" }),
    makeEl("field", { x: 44, y: 23, w: 110, h: 11 }, { field: "companyAddress", size: 9, color: "#475569" }),
    makeEl("photo", { x: 162, y: 12, w: 33, h: 40 }, { borderWidth: 0.3 }),
    makeEl("line", { x: 15, y: 40, w: 142, h: 1 }, { borderColor: "#044bab", borderWidth: 0.8 }),
    makeEl("text", { x: 15, y: 46, w: 142, h: 10 }, { text: "Admission Form", size: 20, bold: true, upper: true, align: "center" }),
    heading("Student details", 62),
    ...row("Student name", "studentName", 15, 74, 180),
    ...row("Date of birth", "dateOfBirth", 15, 84, 88),
    ...row("Gender", "gender", 107, 84, 88, 22),
    ...row("Blood group", "bloodGroup", 15, 94, 88),
    ...row("Student ID", "studentId", 107, 94, 88, 22),
    ...row("Address", "address", 15, 104, 180),
    makeEl("line", { x: 15, y: 120, w: 180, h: 1 }, { borderColor: "#94a3b8" }),
    heading("Sport & batch", 128),
    ...row("Sport", "sport", 15, 140, 88),
    ...row("Batch", "batch", 107, 140, 88, 22),
    ...row("Coach", "coach", 15, 150, 88),
    ...row("Admission date", "enrollmentDate", 107, 150, 88, 30),
    ...row("Experience", "experienceLevel", 15, 160, 88),
    ...row("Previous academy", "previousAcademy", 107, 160, 88, 36),
  ];
  const p2: AfEl[] = [
    heading("Parent / guardian details", 15),
    ...row("Father's name", "fatherName", 15, 27, 88),
    ...row("Phone", "fatherPhone", 107, 27, 88, 18),
    ...row("Mother's name", "motherName", 15, 37, 88),
    ...row("Phone", "motherPhone", 107, 37, 88, 18),
    ...row("Guardian email", "guardianEmail", 15, 47, 180),
    heading("Emergency & medical", 58),
    ...row("Emergency contact", "emergencyPerson", 15, 70, 88),
    ...row("Phone", "emergencyPhone", 107, 70, 88, 18),
    ...row("Medical notes", "medicalNotes", 15, 80, 180),
    makeEl("line", { x: 15, y: 96, w: 180, h: 1 }, { borderColor: "#94a3b8" }),
    heading("Declaration", 104),
    makeEl("text", { x: 15, y: 114, w: 180, h: 40 }, {
      text: "I hereby declare that the information given above is true and correct. I agree to abide by the rules and regulations of the academy and understand that the academy will not be responsible for any injury or loss of personal belongings during training. I permit my ward to take part in all training activities.",
      size: 10,
      align: "left",
    }),
    makeEl("signature", { x: 15, y: 245, w: 52, h: 14 }, { text: "Parent / Guardian" }),
    makeEl("signature", { x: 79, y: 245, w: 52, h: 14 }, { text: "Student" }),
    makeEl("signature", { x: 143, y: 245, w: 52, h: 14 }, { text: "Authorised signatory" }),
    makeEl("field", { x: 15, y: 270, w: 90, h: 6 }, { field: "companyName", size: 8, color: "#64748b" }),
  ];
  return { v: 1, pages: [{ bg: "#ffffff", elements: p1 }, { bg: "#ffffff", elements: p2 }] };
}

/** Fills in anything missing so older / partial designs always render. */
export function normalizeTemplate(raw: any): AdmissionFormTemplate {
  if (!raw || !Array.isArray(raw.pages) || !raw.pages.length)
    return defaultTemplate();
  return {
    v: 1,
    pages: raw.pages.slice(0, MAX_PAGES).map((p: any) => ({
      bg: p?.bg || "#ffffff",
      elements: (p?.elements || []).map((e: any) =>
        makeEl(e.kind, { x: 0, y: 0, w: 10, h: 5 }, e),
      ),
    })),
  };
}

/** Absolute URL for an uploaded path (print windows have no base URL). */
export function assetUrl(path?: string): string {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const origin =
    (import.meta.env.VITE_API_URL as string | undefined)?.replace(
      /\/api\/?$/,
      "",
    ) || window.location.origin;
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

const safeColor = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : "#000000");

function innerHTML(
  el: AfEl,
  student: any,
  company: AfCompany,
): string {
  const bc = safeColor(el.borderColor);
  const textCss = [
    "width:100%",
    "height:100%",
    "box-sizing:border-box",
    "overflow:hidden",
    "display:flex",
    el.kind === "text" ? "align-items:flex-start" : "align-items:flex-end",
    `justify-content:${el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start"}`,
    `text-align:${el.align}`,
    `font-family:${FONT_STACKS[el.font]}`,
    `font-size:${el.size}pt`,
    "line-height:1.3",
    `color:${safeColor(el.color)}`,
    `font-weight:${el.bold ? 700 : 400}`,
    `font-style:${el.italic ? "italic" : "normal"}`,
    `text-transform:${el.upper ? "uppercase" : "none"}`,
    "white-space:pre-wrap",
    "word-break:break-word",
    el.filled ? `background:${safeColor(el.fill)};padding:0 2mm;align-items:center` : "",
    el.underline ? `border-bottom:${Math.max(el.borderWidth, 0.2)}mm solid ${bc}` : "",
  ]
    .filter(Boolean)
    .join(";");

  switch (el.kind) {
    case "text":
      return `<div style="${textCss}">${escapeHtml(el.text)}</div>`;
    case "field": {
      const v = fieldValue(el.field, student, company);
      return `<div style="${textCss}">${escapeHtml(el.prefix)}${escapeHtml(v)}</div>`;
    }
    case "photo": {
      const src = assetUrl(student?.avatar);
      const frame = `width:100%;height:100%;box-sizing:border-box;border:${el.borderWidth}mm solid ${bc}`;
      return src
        ? `<img src="${escapeHtml(src)}" alt="" style="${frame};object-fit:cover;display:block">`
        : `<div style="${frame};display:flex;align-items:center;justify-content:center;color:#94a3b8;font:8pt ${FONT_STACKS.sans};text-align:center">Paste<br>photo here</div>`;
    }
    case "logo":
      return company.logoUrl
        ? `<img src="${escapeHtml(company.logoUrl)}" alt="" style="width:100%;height:100%;object-fit:contain;display:block">`
        : "";
    case "image": {
      const src = assetUrl(el.src);
      return src
        ? `<img src="${escapeHtml(src)}" alt="" style="width:100%;height:100%;object-fit:contain;display:block">`
        : "";
    }
    case "line":
      return `<div style="position:absolute;left:0;right:0;top:50%;border-top:${el.borderWidth}mm solid ${bc}"></div>`;
    case "box":
      return `<div style="width:100%;height:100%;box-sizing:border-box;border:${el.borderWidth}mm solid ${bc};${el.filled ? `background:${safeColor(el.fill)}` : ""}"></div>`;
    case "signature":
      return `<div style="position:absolute;left:0;right:0;top:62%;border-top:${Math.max(el.borderWidth, 0.2)}mm solid ${bc}"></div><div style="position:absolute;left:0;right:0;top:68%;text-align:center;font-family:${FONT_STACKS[el.font]};font-size:${el.size}pt;color:${safeColor(el.color)};font-weight:${el.bold ? 700 : 400}">${escapeHtml(el.text)}</div>`;
  }
}

/** One A4 page as an HTML string (210 x 297 mm). `student` null prints a blank form. */
export function pageHTML(
  page: AfPage,
  student: any,
  company: AfCompany,
): string {
  const els = page.elements
    .map(
      (el) =>
        `<div style="position:absolute;left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;${el.rotate ? `transform:rotate(${el.rotate}deg);` : ""}">${innerHTML(el, student, company)}</div>`,
    )
    .join("");
  return `<div class="af-page" style="position:relative;width:${A4_W}mm;height:${A4_H}mm;background:${safeColor(page.bg)};overflow:hidden;box-sizing:border-box">${els}</div>`;
}

/** The full printable document: every page, A4, one per sheet. */
export function buildAdmissionFormHTML(
  template: AdmissionFormTemplate,
  students: any[],
  company: AfCompany,
): string {
  const list = students.length ? students : [null];
  const pages = list
    .flatMap((s) => template.pages.map((p) => pageHTML(p, s, company)))
    .map((p) => `<div class="sheet">${p}</div>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Admission form</title><style>
@page{size:A4;margin:0}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0;background:#e5e7eb}
.sheet{width:${A4_W}mm;height:${A4_H}mm;margin:0 auto 6mm;background:#fff;page-break-after:always;break-after:page;overflow:hidden}
@media print{html,body{background:#fff}.sheet{margin:0}}
</style></head><body>${pages}</body></html>`;
}
