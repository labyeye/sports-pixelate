import { API_BASE_URL } from '../config';
import { settingsAPI } from '../api/client';
import { normalizeTemplate } from './idCardLibrary';
import type { IdCardTemplate, IdCompany } from './idCard';

const ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

/** Absolute URL for an uploaded file path. */
export function assetUrl(path?: string): string {
  if (!path) return '';
  if (/^(https?:|data:|file:)/i.test(path)) return path;
  return `${ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function companyFromSettings(s: any): IdCompany {
  return {
    name: s?.companyName || '',
    address: s?.companyAddress || '',
    phone: s?.companyPhone || '',
    email: s?.companyEmail || '',
    website: s?.companyWebsite || '',
    logoUrl: assetUrl(s?.logoUrl),
  };
}

/** This company's saved ID-card design and company details (the default design when none is saved yet). */
export async function loadIdCardSetup(): Promise<{
  template: IdCardTemplate;
  company: IdCompany;
  saved: boolean;
}> {
  const res: any = await settingsAPI.get();
  const s = res?.data ?? res;
  return {
    template: normalizeTemplate(s?.idCardTemplate),
    company: companyFromSettings(s),
    saved: !!s?.idCardTemplate,
  };
}
