import { settingsAPI } from "@/services/api";
import { assetUrl } from "@/components/idcard/IdCardView";
import {
  toStudentTemplate,
  type CardKind,
  type IdCardTemplate,
  type IdCompany,
} from "@/lib/idCard";
import { normalizeTemplate } from "@/lib/idCardLibrary";

export function companyFromSettings(s: any): IdCompany {
  return {
    name: s?.companyName || "",
    address: s?.companyAddress || "",
    phone: s?.companyPhone || "",
    email: s?.companyEmail || "",
    website: s?.companyWebsite || "",
    logoUrl: assetUrl(s?.logoUrl),
  };
}

/** This company's saved ID-card design and company details (the default design when none is saved yet). */
export async function loadIdCardSetup(kind: CardKind = "staff"): Promise<{
  template: IdCardTemplate;
  company: IdCompany;
  saved: boolean;
}> {
  const res = await settingsAPI.get();
  const s = res?.data;
  const raw = kind === "student" ? s?.studentIdCardTemplate : s?.idCardTemplate;
  const template = normalizeTemplate(raw);
  return {
    // nothing saved yet: students start from the default design with student fields
    template: !raw && kind === "student" ? toStudentTemplate(template) : template,
    company: companyFromSettings(s),
    saved: !!raw,
  };
}
