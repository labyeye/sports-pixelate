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
  markSlipReceived: (id: string, status: 'received' | 'not_received') =>
    request(`/payroll/${id}/slip-received`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export const departmentAPI = {
  getAll: () => request('/departments'),
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
    tier: 'standard' | 'whatsapp' = 'standard',
  ) =>
    request('/billing/create-order', {
      method: 'POST',
      body: JSON.stringify({
        studentCount,
        billingCycle,
        gateway,
        company,
        tier,
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
  getDeductionRules: () => request('/payroll-config/deduction-rules'),
  upsertDeductionRules: (body: object) =>
    request('/payroll-config/deduction-rules', {
      method: 'PUT',
      body: JSON.stringify(body),
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
};

export const sportsPlanAPI = {
  getAll: () => request('/plans'),
  create: (body: object) =>
    request('/plans', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/plans/${id}`, { method: 'DELETE' }),
};

export const tournamentAPI = {
  getAll: () => request('/tournaments'),
  getOne: (id: string) => request(`/tournaments/${id}`),
  create: (body: object) =>
    request('/tournaments', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/tournaments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/tournaments/${id}`, { method: 'DELETE' }),
  addTeam: (id: string, name: string) =>
    request(`/tournaments/${id}/teams`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  removeTeam: (id: string, teamId: string) =>
    request(`/tournaments/${id}/teams/${teamId}`, { method: 'DELETE' }),
  generateFixtures: (
    id: string,
    opts?: { regenerate?: boolean; shuffle?: boolean },
  ) =>
    request(`/tournaments/${id}/fixtures/generate`, {
      method: 'POST',
      body: JSON.stringify(opts || {}),
    }),
  getFixtures: (id: string) => request(`/tournaments/${id}/fixtures`),
  recordResult: (
    fixtureId: string,
    body: { scoreA?: number; scoreB?: number; winner?: 'A' | 'B' },
  ) =>
    request(`/tournaments/fixtures/${fixtureId}/result`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  register: (id: string, studentId: string) =>
    request(`/tournaments/${id}/registrations`, {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    }),
  unregister: (id: string, studentId: string) =>
    request(`/tournaments/${id}/registrations/${studentId}`, {
      method: 'DELETE',
    }),
};

export const subscriptionAPI = {
  getAll: () => request('/subscriptions'),
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
  createQrRenewalRequest: (body: {
    studentId: string;
    planId: string;
    billingCycle?: string;
    referenceNumber: string;
  }) =>
    request('/subscriptions/qr-renewal', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  cancel: (id: string) =>
    request(`/subscriptions/${id}/cancel`, { method: 'POST' }),
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
  getAll: () => request('/facilities'),
  create: (body: object) =>
    request('/facilities', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/facilities/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/facilities/${id}`, { method: 'DELETE' }),
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
