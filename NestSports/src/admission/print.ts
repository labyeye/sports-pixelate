import RNPrint from 'react-native-print';
import { settingsAPI, studentAPI } from '../api/client';
import { companyFromSettings } from '../idcard/data';
import { buildAdmissionFormHTML, normalizeTemplate } from './admissionForm';

/**
 * Prints (or saves as PDF from the system print sheet) a student's admission form on A4, using the design saved in
 * the web dashboard under Settings → Admission Form Designer. A null student prints a blank form.
 */
export async function printAdmissionForm(student: any | null) {
  const [settingsRes, studentRes] = await Promise.all([
    settingsAPI.get(),
    student ? studentAPI.getOne(student._id).catch(() => null) : null,
  ]);
  const s = settingsRes?.data;
  const full = student ? studentRes?.data ?? student : null;
  const html = buildAdmissionFormHTML(
    normalizeTemplate(s?.admissionFormTemplate),
    full ? [full] : [],
    companyFromSettings(s),
  );
  await RNPrint.print({ html });
}
