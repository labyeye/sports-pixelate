import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = 'hrms_token';

let cachedToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cachedToken !== null) return cachedToken;
  cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
  return cachedToken;
}

export async function setToken(token: string) {
  cachedToken = token;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function removeToken() {
  cachedToken = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// A file picked on-device (image picker / document picker) — the RN
// equivalent of a browser File for multipart uploads.
export interface RNFile {
  uri: string;
  name: string;
  type: string;
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data.message || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

async function upload<T = any>(
  endpoint: string,
  form: FormData,
  method = 'POST',
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Upload failed');
  return data;
}

function toFormData(fields: Record<string, RNFile | undefined>): FormData {
  const form = new FormData();
  for (const [key, file] of Object.entries(fields)) {
    if (file) form.append(key, file as any);
  }
  return form;
}

function toFormDataWithFields(
  textFields: Record<string, string | undefined>,
  files: Record<string, RNFile | undefined>,
): FormData {
  const form = toFormData(files);
  for (const [key, value] of Object.entries(textFields)) {
    if (value !== undefined) form.append(key, value);
  }
  return form;
}

export const authAPI = {
  login: (email: string, password: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, client: 'mobile' }),
    }),
  register: (body: { name: string; email: string; password: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => request('/auth/me'),
  updateProfile: (body: object) =>
    request('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  forgotPassword: (email: string) =>
    request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request(`/auth/reset-password/${token}`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  setup2FA: () => request('/auth/2fa/setup', { method: 'POST' }),
  confirm2FA: (token: string) =>
    request('/auth/2fa/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  disable2FA: (token: string) =>
    request('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  verify2FA: (userId: string, token: string) =>
    request('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ userId, token }),
    }),
  sendPhoneOtp: (phone: string) =>
    request('/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  verifyPhoneOtp: (phone: string, otp: string) =>
    request('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    }),
};

export const dashboardAPI = {
  getStats: () => request('/dashboard/stats'),
  getEmployeeStats: () => request('/dashboard/employee'),
};

export const employeeAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/employees${q}`);
  },
  getMe: () => request('/employees/me'),
  getOne: (id: string) => request(`/employees/${id}`),
  create: (body: object) =>
    request('/employees', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/employees/${id}`, { method: 'DELETE' }),
  resetPassword: (id: string, password: string) =>
    request(`/employees/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  uploadDocuments: (
    id: string,
    files: { aadhaarDoc?: RNFile; panDoc?: RNFile; resumeDoc?: RNFile },
  ) => upload(`/employees/${id}/documents`, toFormData(files)),
  enrollFace: (id: string, photo: RNFile) =>
    upload(`/employees/${id}/face-enroll`, toFormData({ photo })),
  enrollMyFace: (photo: RNFile) =>
    upload('/employees/me/face-enroll', toFormData({ photo })),
  bulkImport: (employees: object[]) =>
    request('/employees/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ employees }),
    }),
};

export const attendanceAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/attendance${q}`);
  },
  mark: (body: object) =>
    request('/attendance', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/attendance/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  bulkMark: (body: object) =>
    request('/attendance/bulk', { method: 'POST', body: JSON.stringify(body) }),
  getSummary: (params: Record<string, string>) =>
    request(`/attendance/summary?${new URLSearchParams(params).toString()}`),
  // Geofenced mobile self check-in/out — verifies the selfie against the
  // employee's enrolled face descriptor and their location against their
  // configured geofence, server-side.
  selfMark: (
    body: { action: 'checkin' | 'checkout'; lat: number; lng: number; accuracy?: number },
    selfie: RNFile,
  ) =>
    upload(
      '/attendance/self-mark',
      toFormDataWithFields(
        {
          action: body.action,
          lat: String(body.lat),
          lng: String(body.lng),
          accuracy: body.accuracy != null ? String(body.accuracy) : undefined,
        },
        { selfie },
      ),
    ),
};

export const leaveAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/leaves${q}`);
  },
  create: (body: object) =>
    request('/leaves', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/leaves/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateStatus: (id: string, body: object) =>
    request(`/leaves/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string, body?: object) =>
    request(`/leaves/${id}`, {
      method: 'DELETE',
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
};

export const payrollAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/payroll${q}`);
  },
  getMy: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/payroll/my${q}`);
  },
  process: (body: object) =>
    request('/payroll/process', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/payroll/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  markPaid: (id: string, paymentMode?: string) =>
    request(`/payroll/${id}/paid`, {
      method: 'PUT',
      body: JSON.stringify({ paymentMode }),
    }),
  bulkMarkPaid: (month: number, year: number, paymentMode?: string) =>
    request('/payroll/bulk-paid', {
      method: 'POST',
      body: JSON.stringify({ month, year, paymentMode }),
    }),
  markSlipReceived: (id: string, status: 'received' | 'not_received') =>
    request(`/payroll/${id}/slip-received`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export const departmentAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/departments${q}`);
  },
  getOne: (id: string) => request(`/departments/${id}`),
  create: (body: object) =>
    request('/departments', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/departments/${id}`, { method: 'DELETE' }),
};

export const settingsAPI = {
  get: () => request('/settings'),
  update: (settings: any) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  uploadLogo: (logo: RNFile) => upload('/settings/logo', toFormData({ logo })),
  uploadPaymentQr: (qrCode: RNFile) =>
    upload('/settings/payment-qr', toFormData({ qrCode })),
};

export const billingAPI = {
  getPlans: () => request('/billing/plans'),
  getSubscription: () => request('/billing/subscription'),
  getInvoices: () => request('/billing/invoices'),
  createOrder: (
    studentCount: number,
    billingCycle: 'monthly' | 'yearly',
    gateway: 'razorpay' | 'hdfc' = 'razorpay',
    company?: object,
  ) =>
    request('/billing/create-order', {
      method: 'POST',
      body: JSON.stringify({
        studentCount,
        billingCycle,
        gateway,
        company,
      }),
    }),
  verifyPayment: (payload: object) =>
    request('/billing/verify-payment', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getPaymentMethods: () => request('/payment-methods'),
  addPaymentMethod: (body: object) =>
    request('/payment-methods', { method: 'POST', body: JSON.stringify(body) }),
  deletePaymentMethod: (id: string) =>
    request(`/payment-methods/${id}`, { method: 'DELETE' }),
};

export const holidayAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/holidays${q}`);
  },
  create: (body: object) =>
    request('/holidays', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/holidays/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/holidays/${id}`, { method: 'DELETE' }),
};

export const payrollConfigAPI = {
  getAllConfigs: () => request('/payroll-config/employee-configs'),
  getConfig: (employeeId: string) =>
    request(`/payroll-config/employee-configs/${employeeId}`),
  upsertConfig: (employeeId: string, body: object) =>
    request(`/payroll-config/employee-configs/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const attendanceSettingsAPI = {
  get: () => request('/attendance-settings'),
  update: (body: object) =>
    request('/attendance-settings', { method: 'PUT', body: JSON.stringify(body) }),
  upsertLateAllowance: (body: {
    mode: 'bulk' | 'custom';
    bulkCount?: number;
    perEmployee?: { employee: string; count: number }[];
  }) =>
    request('/attendance-settings/late-allowance', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  upsertLeaveAllowance: (body: {
    leaveType: string;
    mode: 'bulk' | 'custom';
    bulkDays?: number;
    perEmployee?: { employee: string; days: number }[];
  }) =>
    request('/attendance-settings/leave-allowance', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  getBalanceSummary: () => request('/attendance-settings/balance-summary'),
  getMyBalance: () => request('/attendance-settings/my-balance'),
};

export const lateApprovalAPI = {
  getAll: (status?: string) =>
    request(`/late-approvals${status ? `?status=${status}` : ''}`),
  resolve: (id: string, resolvedStatus: string) =>
    request(`/late-approvals/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolvedStatus }),
    }),
};

export const companyAPI = {
  getMe: () => request('/company/me'),
  update: (body: object) =>
    request('/company', { method: 'PUT', body: JSON.stringify(body) }),
};

export const loanAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/loans${q}`);
  },
  create: (body: object) =>
    request('/loans', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/loans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  updateStatus: (id: string, body: object) =>
    request(`/loans/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/loans/${id}`, { method: 'DELETE' }),
  bulkImport: (loans: object[]) =>
    request('/loans/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ loans }),
    }),
};

export const designationAPI = {
  getAll: () => request('/designations'),
  create: (body: object) =>
    request('/designations', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/designations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/designations/${id}`, { method: 'DELETE' }),
};

export const auditAPI = {
  getLogs: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/audit${q}`);
  },
};

export const supportAPI = {
  getAll: () => request('/support'),
  getOne: (id: string) => request(`/support/${id}`),
  create: (body: {
    subject: string;
    issueType: string;
    priority: string;
    description: string;
  }) => request('/support', { method: 'POST', body: JSON.stringify(body) }),
  reply: (id: string, message: string) =>
    request(`/support/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  close: (id: string) => request(`/support/${id}/close`, { method: 'POST' }),
};

export const documentAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/documents${q}`);
  },
  upload: (body: {
    employeeId?: string;
    name: string;
    docType: string;
    mimeType: string;
    fileData: string;
  }) => request('/documents', { method: 'POST', body: JSON.stringify(body) }),
  download: (id: string) => request(`/documents/${id}/download`),
  delete: (id: string) => request(`/documents/${id}`, { method: 'DELETE' }),
};

export const announcementAPI = {
  getAll: () => request('/announcements'),
};

export const attendanceCorrectionAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/attendance-corrections${q}`);
  },
  create: (body: {
    date: string;
    type: 'regularization' | 'missed_punch';
    checkIn?: string;
    checkOut?: string;
    reason: string;
  }) =>
    request('/attendance-corrections', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateStatus: (
    id: string,
    status: 'approved' | 'rejected',
    rejectionReason?: string,
  ) =>
    request(`/attendance-corrections/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, rejectionReason }),
    }),
};

// ── NestSports domain APIs ──────────────────────────────────────────────

export const studentAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/students${q}`);
  },
  getOne: (id: string) => request(`/students/${id}`),
  create: (body: object) =>
    request('/students', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/students/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/students/${id}`, { method: 'DELETE' }),
  uploadAvatar: (id: string, avatar: RNFile) =>
    upload(`/students/${id}/avatar`, toFormData({ avatar })),
  uploadGuardianPhoto: (id: string, guardianId: string, photo: RNFile) =>
    upload(
      `/students/${id}/guardians/${guardianId}/photo`,
      toFormData({ photo }),
    ),
  enrollFace: (id: string, photo: RNFile) =>
    upload(`/students/${id}/face-enroll`, toFormData({ photo })),
  bulkImport: (students: object[]) =>
    request('/students/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ students }),
    }),
};

export const sportAPI = {
  getAll: () => request('/sports'),
};

export const studentAttendanceAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/student-attendance${q}`);
  },
  mark: (body: object) =>
    request('/student-attendance', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  bulkMark: (body: object) =>
    request('/student-attendance/bulk', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  markByFace: (
    fields: { student: string; date: string; batch?: string },
    selfie: RNFile,
  ) =>
    upload(
      '/student-attendance/face-mark',
      toFormDataWithFields(fields, { selfie }),
    ),
};

export const sportsPlanAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/plans${q}`);
  },
  create: (body: object) =>
    request('/plans', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/plans/${id}`, { method: 'DELETE' }),
  bulkImport: (plans: object[]) =>
    request('/plans/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ plans }),
    }),
};

// Generic Event Management System — replaces the sports-only tournamentAPI.
// Base path /api/events (was /api/tournaments, now removed — 404).
export const eventAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/events${q}`);
  },
  getOne: (id: string) => request(`/events/${id}`),
  create: (body: object) =>
    request('/events', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/events/${id}`, { method: 'DELETE' }),
  getDashboard: (id: string) => request(`/events/${id}/dashboard`),
  uploadImages: (
    id: string,
    files: { coverImage?: RNFile; bannerImage?: RNFile },
  ) => upload(`/events/${id}/images`, toFormData(files)),

  addTeam: (id: string, name: string) =>
    request(`/events/${id}/teams`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  removeTeam: (id: string, teamId: string) =>
    request(`/events/${id}/teams/${teamId}`, { method: 'DELETE' }),

  register: (id: string, studentId: string) =>
    request(`/events/${id}/registrations`, {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    }),
  unregister: (id: string, studentId: string) =>
    request(`/events/${id}/registrations/${studentId}`, {
      method: 'DELETE',
    }),

  generateFixtures: (
    id: string,
    opts?: { regenerate?: boolean; shuffle?: boolean },
  ) =>
    request(`/events/${id}/fixtures/generate`, {
      method: 'POST',
      body: JSON.stringify(opts || {}),
    }),
  getFixtures: (id: string) => request(`/events/${id}/fixtures`),
  recordResult: (
    fixtureId: string,
    body: { scoreA?: number; scoreB?: number; winner?: 'A' | 'B' },
  ) =>
    request(`/events/fixtures/${fixtureId}/result`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  addOfficial: (id: string, body: { name: string; role?: string; phone?: string; email?: string }) =>
    request(`/events/${id}/officials`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateOfficial: (
    id: string,
    officialId: string,
    body: { name?: string; role?: string; phone?: string; email?: string },
  ) =>
    request(`/events/${id}/officials/${officialId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  removeOfficial: (id: string, officialId: string) =>
    request(`/events/${id}/officials/${officialId}`, { method: 'DELETE' }),

  addDocument: (
    id: string,
    file: RNFile,
    fields: { kind: string; label?: string },
  ) =>
    upload(`/events/${id}/documents`, toFormDataWithFields(fields, { file })),
  removeDocument: (id: string, docId: string) =>
    request(`/events/${id}/documents/${docId}`, { method: 'DELETE' }),

  getGallery: (id: string) => request(`/events/${id}/gallery`),
  addGalleryPhoto: (id: string, photo: RNFile, caption?: string) =>
    upload(
      `/events/${id}/gallery`,
      toFormDataWithFields({ caption }, { photo }),
    ),
  removeGalleryItem: (id: string, itemId: string) =>
    request(`/events/${id}/gallery/${itemId}`, { method: 'DELETE' }),

  getAnnouncements: (id: string) => request(`/events/${id}/announcements`),
  addAnnouncement: (id: string, body: { title: string; message: string }) =>
    request(`/events/${id}/announcements`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getPayments: (id: string) => request(`/events/${id}/payments`),
  getAttendance: (id: string) => request(`/events/${id}/attendance`),
};

export const subscriptionAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/subscriptions${q}`);
  },
  createOrder: (body: {
    studentId: string;
    planId: string;
    billingCycle?: string;
  }) =>
    request('/subscriptions/create-order', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  verifyPayment: (body: object) =>
    request('/subscriptions/verify-payment', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  // Owner/staff assigns a plan to a student (e.g. from the student form) —
  // creates a pending subscription with no payment attached yet.
  assign: (body: { studentId: string; planId: string; billingCycle?: string }) =>
    request('/subscriptions/assign', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createQrRenewalRequest: (body: {
    studentId: string;
    planId: string;
    billingCycle?: string;
    method?: 'qr' | 'cash';
    referenceNumber?: string;
    transactionNumber?: string;
    amount?: number;
    screenshot?: RNFile;
  }) =>
    upload(
      '/subscriptions/qr-renewal',
      toFormDataWithFields(
        {
          studentId: body.studentId,
          planId: body.planId,
          billingCycle: body.billingCycle || 'monthly',
          method: body.method || 'qr',
          referenceNumber: body.referenceNumber,
          transactionNumber: body.transactionNumber,
          amount: body.amount !== undefined ? String(body.amount) : undefined,
        },
        { screenshot: body.screenshot },
      ),
    ),
  // Top up the remaining balance on an existing subscription — either
  // another UTR/transaction/screenshot submission (UPI) or a self-declared
  // cash payment (installment payment either way).
  submitPayment: (
    subscriptionId: string,
    body: {
      method?: 'qr' | 'cash';
      referenceNumber?: string;
      transactionNumber?: string;
      amount: number;
      screenshot?: RNFile;
    },
  ) =>
    upload(
      `/subscriptions/${subscriptionId}/payments`,
      toFormDataWithFields(
        {
          method: body.method || 'qr',
          referenceNumber: body.referenceNumber,
          transactionNumber: body.transactionNumber,
          amount: String(body.amount),
        },
        { screenshot: body.screenshot },
      ),
    ),
  verifyQrPayment: (subscriptionId: string, paymentId: string) =>
    request(`/subscriptions/${subscriptionId}/payments/${paymentId}/verify`, {
      method: 'POST',
    }),
  rejectQrPayment: (subscriptionId: string, paymentId: string, reason?: string) =>
    request(`/subscriptions/${subscriptionId}/payments/${paymentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  receiptUrl: (subscriptionId: string, paymentId: string) =>
    `${API_BASE_URL}/subscriptions/${subscriptionId}/payments/${paymentId}/receipt`,
  // Owner/staff records a payment received in cash — verified immediately,
  // no UTR/screenshot/pending-review step.
  recordCashSubscription: (body: {
    studentId: string;
    planId: string;
    billingCycle?: string;
    amount?: number;
  }) =>
    request('/subscriptions/cash', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  recordCashTopUp: (subscriptionId: string, amount?: number) =>
    request(`/subscriptions/${subscriptionId}/cash-payment`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  cancel: (id: string) =>
    request(`/subscriptions/${id}/cancel`, { method: 'POST' }),
  bulkImport: (subscriptions: object[]) =>
    request('/subscriptions/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ subscriptions }),
    }),
};

export const reportAPI = {
  studentFees: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/reports/student-fees${q}`);
  },
  studentPerformance: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/reports/student-performance${q}`);
  },
  studentEnrollment: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/reports/student-enrollment${q}`);
  },
  batchSummary: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/reports/batch-summary${q}`);
  },
  sportSummary: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/reports/sport-summary${q}`);
  },
  studentProfile: (studentId: string) =>
    request(`/reports/student-profile/${studentId}`),
};

export const expenseAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/expenses${q}`);
  },
  create: (body: object) =>
    request('/expenses', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/expenses/${id}`, { method: 'DELETE' }),
};

export const inventoryAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/inventory${q}`);
  },
  create: (body: object) =>
    request('/inventory', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/inventory/${id}`, { method: 'DELETE' }),
  bulkImport: (items: object[]) =>
    request('/inventory/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
  uploadPhoto: (id: string, photo: RNFile) =>
    upload(`/inventory/${id}/photo`, toFormData({ photo })),
  recordTransaction: (id: string, body: object) =>
    request(`/inventory/${id}/transactions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  assign: (id: string, body: object) =>
    request(`/inventory/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  returnAssignment: (id: string, assignmentId: string) =>
    request(`/inventory/${id}/assignments/${assignmentId}/return`, {
      method: 'POST',
    }),
};

export const facilityAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/facilities${q}`);
  },
  create: (body: object) =>
    request('/facilities', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/facilities/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/facilities/${id}`, { method: 'DELETE' }),
};

export type PersonType = 'employee' | 'student';

export const biometricAPI = {
  getLocations: () => request('/biometric/locations'),
  createLocation: (body: object) =>
    request('/biometric/locations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateLocation: (id: string, body: object) =>
    request(`/biometric/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteLocation: (id: string) =>
    request(`/biometric/locations/${id}`, { method: 'DELETE' }),

  getDevices: () => request('/biometric/devices'),
  createDevice: (body: object) =>
    request('/biometric/devices', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateDevice: (id: string, body: object) =>
    request(`/biometric/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteDevice: (id: string) =>
    request(`/biometric/devices/${id}`, { method: 'DELETE' }),
  regenerateDeviceToken: (id: string) =>
    request(`/biometric/devices/${id}/regenerate-token`, { method: 'POST' }),

  assignNfcCard: (
    deviceId: string,
    uid: string,
    personType: PersonType,
    personId: string,
    label?: string,
  ) =>
    request(`/biometric/devices/${deviceId}/nfc`, {
      method: 'POST',
      body: JSON.stringify({ uid, personType, personId, label }),
    }),
  removeNfcCard: (deviceId: string, uid: string) =>
    request(`/biometric/devices/${deviceId}/nfc/${uid}`, { method: 'DELETE' }),

  getLogs: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/biometric/logs${q}`);
  },

  setDeviceSerial: (id: string, serialNumber: string) =>
    request(`/biometric/devices/${id}/serial`, {
      method: 'PUT',
      body: JSON.stringify({ serialNumber }),
    }),
  syncPersonToDevice: (
    deviceId: string,
    personType: PersonType,
    personId: string,
    rfidCard?: string,
  ) =>
    request(`/biometric/devices/${deviceId}/sync-person`, {
      method: 'POST',
      body: JSON.stringify({ personType, personId, rfidCard }),
    }),
  syncAllToDevice: (deviceId: string) =>
    request(`/biometric/devices/${deviceId}/sync-all`, { method: 'POST' }),
  removePersonFromDevice: (
    deviceId: string,
    personType: PersonType,
    personId: string,
  ) =>
    request(
      `/biometric/devices/${deviceId}/sync-person/${personType}/${personId}`,
      { method: 'DELETE' },
    ),
  getDeviceCommands: (deviceId: string) =>
    request(`/biometric/devices/${deviceId}/commands`),

  assignBiometricUserId: (
    personType: PersonType,
    personId: string,
    biometricUserId: string,
  ) =>
    request(`/biometric/people/${personType}/${personId}/biometric-id`, {
      method: 'POST',
      body: JSON.stringify({ biometricUserId }),
    }),

  saveRfidCard: (personType: PersonType, personId: string, rfidCard: string) =>
    request(`/biometric/people/${personType}/${personId}/rfid`, {
      method: 'POST',
      body: JSON.stringify({ rfidCard }),
    }),

  saveFaceDescriptor: (
    personType: PersonType,
    personId: string,
    descriptor: number[],
  ) =>
    request(`/biometric/people/${personType}/${personId}/face`, {
      method: 'POST',
      body: JSON.stringify({ descriptor }),
    }),
  getFaceDescriptors: () => request('/biometric/face-descriptors'),

  enrollFingerprint: (
    deviceId: string,
    personType: PersonType,
    personId: string,
    fingerIndex = 0,
  ) =>
    request(`/biometric/devices/${deviceId}/enroll-fingerprint`, {
      method: 'POST',
      body: JSON.stringify({ personType, personId, fingerIndex }),
    }),

  enrollFaceOnDevice: (
    deviceId: string,
    personType: PersonType,
    personId: string,
  ) =>
    request(`/biometric/devices/${deviceId}/enroll-face-device`, {
      method: 'POST',
      body: JSON.stringify({ personType, personId }),
    }),

  pushFaceTemplateToDevice: (
    deviceId: string,
    personType: PersonType,
    personId: string,
  ) =>
    request(`/biometric/devices/${deviceId}/push-face-template`, {
      method: 'POST',
      body: JSON.stringify({ personType, personId }),
    }),
};

export const bookingAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/bookings${q}`);
  },
  create: (body: object) =>
    request('/bookings', { method: 'POST', body: JSON.stringify(body) }),
  verifyPayment: (body: object) =>
    request('/bookings/verify-payment', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  cancel: (id: string) => request(`/bookings/${id}/cancel`, { method: 'POST' }),
};
