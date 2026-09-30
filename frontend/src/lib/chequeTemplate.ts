// A payroll cheque / payslip is one background image (a scanned cheque leaf, a payslip letterhead,
// whatever the company prints on) with a handful of values overlaid on top — company logo, employee
// name, net amount, dates, signature. Unlike an invoice there's no reflowing content, so this design
// is just a flat list of "fields" positioned in percent of the background image, exactly like the
// invoice designer's floating images/text. That's the whole model.

export type FieldKind = "text" | "image";

export interface ChequeField {
  id: string;
  kind: FieldKind;
  x: number; // percent of background width
  y: number; // percent of background height
  w: number; // percent
  h: number; // percent
  visible: boolean;
  // text
  text?: string; // may contain {{variables}}
  size?: number; // pt, scaled to background width like the invoice designer
  color?: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
  // image
  src?: string; // data URL; blank = use the company logo for the "logo" preset
  usesCompanyLogo?: boolean;
}

export interface ChequeTemplate {
  version: 1;
  fields: ChequeField[];
}

export const TEMPLATE_VARS = [
  "company.name",
  "company.address",
  "issue.date",
  "emp.name",
  "emp.id",
  "emp.designation",
  "amount.net",
  "amount.words",
  "period.from",
  "period.to",
] as const;

export type VarCtx = Record<(typeof TEMPLATE_VARS)[number], string>;

export function fillVars(text: string | undefined, ctx: VarCtx): string {
  if (!text) return "";
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => ctx[key as keyof VarCtx] ?? "");
}

let seq = 0;
const id = () => `f${Date.now().toString(36)}${(seq++).toString(36)}`;

export function newTextField(patch: Partial<ChequeField> = {}): ChequeField {
  return { id: id(), kind: "text", x: 20, y: 20, w: 30, h: 6, visible: true, text: "New text", size: 11, color: "#000000", bold: false, align: "left", ...patch };
}

export function newImageField(patch: Partial<ChequeField> = {}): ChequeField {
  return { id: id(), kind: "image", x: 5, y: 5, w: 15, h: 10, visible: true, src: "", ...patch };
}

// The layout every company starts from — the same values that used to be hardcoded pixel
// coordinates tuned for the bundled sample cheque, now expressed as percentages so they scale to
// whatever background the company uploads.
export function defaultTemplate(): ChequeTemplate {
  return {
    version: 1,
    fields: [
      newImageField({ x: 10, y: 8, w: 18, h: 12, usesCompanyLogo: true }),
      newTextField({ x: 22, y: 6, w: 45, h: 5, text: "{{company.name}}", size: 13, bold: true }),
      newTextField({ x: 22, y: 11, w: 45, h: 6, text: "{{company.address}}", size: 9, color: "#444444" }),
      newTextField({ x: 78, y: 8, w: 18, h: 5, text: "{{issue.date}}", size: 10, align: "right" }),
      newTextField({ x: 10, y: 32, w: 30, h: 5, text: "{{emp.name}}", size: 10 }),
      newTextField({ x: 42, y: 32, w: 20, h: 5, text: "{{emp.id}}", size: 10 }),
      newTextField({ x: 64, y: 32, w: 30, h: 5, text: "{{emp.designation}}", size: 10 }),
      newTextField({ x: 10, y: 40, w: 55, h: 6, text: "{{amount.words}}", size: 10 }),
      newTextField({ x: 68, y: 40, w: 26, h: 6, text: "Rs. {{amount.net}}", size: 13, bold: true, align: "right" }),
      newTextField({ x: 30, y: 48, w: 20, h: 5, text: "{{period.from}}", size: 10 }),
      newTextField({ x: 55, y: 48, w: 20, h: 5, text: "{{period.to}}", size: 10 }),
      newImageField({ x: 70, y: 62, w: 20, h: 10 }), // signature — blank by default
    ],
  };
}

export function normalizeTemplate(t: any): ChequeTemplate {
  if (!t || !Array.isArray(t.fields)) return defaultTemplate();
  return {
    version: 1,
    fields: t.fields.map((f: any) => ({
      id: f.id || id(),
      kind: f.kind === "image" ? "image" : "text",
      x: Number(f.x) || 0,
      y: Number(f.y) || 0,
      w: Math.max(1, Number(f.w) || 10),
      h: Math.max(1, Number(f.h) || 5),
      visible: f.visible !== false,
      ...(f.kind === "image"
        ? { src: f.src || "", usesCompanyLogo: !!f.usesCompanyLogo }
        : { text: f.text || "", size: Number(f.size) || 10, color: f.color || "#000000", bold: !!f.bold, align: f.align === "center" || f.align === "right" ? f.align : "left" }),
    })),
  };
}

export const FIELD_LABEL = (f: ChequeField) => {
  if (f.kind === "image") return f.usesCompanyLogo ? "Company logo" : "Image";
  const t = (f.text || "").trim();
  return t ? t.slice(0, 28) : "Text";
};
