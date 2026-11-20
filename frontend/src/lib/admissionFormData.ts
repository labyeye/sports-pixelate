import { settingsAPI } from "@/services/api";
import {
  assetUrl,
  normalizeTemplate,
  type AdmissionFormTemplate,
  type AfCompany,
} from "@/lib/admissionForm";

export function companyFromSettings(s: any): AfCompany {
  return {
    name: s?.companyName || "",
    address: s?.companyAddress || "",
    phone: s?.companyPhone || "",
    email: s?.companyEmail || "",
    website: s?.companyWebsite || "",
    logoUrl: assetUrl(s?.logoUrl),
  };
}

/** This company's saved admission-form design and details (the default form when none is saved yet). */
export async function loadAdmissionFormSetup(): Promise<{
  template: AdmissionFormTemplate;
  company: AfCompany;
  saved: boolean;
}> {
  const res = await settingsAPI.get();
  const s = res?.data;
  return {
    template: normalizeTemplate(s?.admissionFormTemplate),
    company: companyFromSettings(s),
    saved: !!s?.admissionFormTemplate,
  };
}
