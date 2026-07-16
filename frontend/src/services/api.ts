const BASE_URL = import.meta.env.VITE_API_URL;

export const getToken = () => localStorage.getItem("hrms_token");
export const setToken = (t: string) => localStorage.setItem("hrms_token", t);
export const removeToken = () => localStorage.removeItem("hrms_token");

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.message || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

export const authAPI = {
  login: (email: string, password: string) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, client: "web" }),
    }),
  register: (body: { name: string; email: string; password: string }) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  getMe: () => request("/auth/me"),
  updateProfile: (body: object) =>
    request("/auth/profile", { method: "PUT", body: JSON.stringify(body) }),
  forgotPassword: (email: string) =>
    request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request(`/auth/reset-password/${token}`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  setup2FA: () => request("/auth/2fa/setup", { method: "POST" }),
  confirm2FA: (token: string) =>
    request("/auth/2fa/confirm", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  disable2FA: (token: string) =>
    request("/auth/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  verify2FA: (userId: string, token: string) =>
    request("/auth/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ userId, token }),
    }),
  sendPhoneOtp: (phone: string) =>
    request("/auth/otp/send", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
  verifyPhoneOtp: (phone: string, otp: string) =>
    request("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, otp }),
    }),
};

export const dashboardAPI = {
  getStats: () => request("/dashboard/stats"),
  getEmployeeStats: () => request("/dashboard/employee"),
};

export const employeeAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/employees${q}`);
  },
  getMe: () => request("/employees/me"),
  getOne: (id: string) => request(`/employees/${id}`),
  create: (body: object) =>
    request("/employees", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/employees/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/employees/${id}`, { method: "DELETE" }),
  resetPassword: (id: string, password: string) =>
    request(`/employees/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  bulkImport: (employees: object[]) =>
    request("/employees/bulk-import", {
      method: "POST",
      body: JSON.stringify({ employees }),
    }),
  uploadDocuments: (
    id: string,
    files: { aadhaarDoc?: File; panDoc?: File; resumeDoc?: File },
  ) => {
    const form = new FormData();
    if (files.aadhaarDoc) form.append("aadhaarDoc", files.aadhaarDoc);
    if (files.panDoc) form.append("panDoc", files.panDoc);
    if (files.resumeDoc) form.append("resumeDoc", files.resumeDoc);
    const token = getToken();
    return fetch(`${BASE_URL}/employees/${id}/documents`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then((r) => r.json());
  },
  getDocumentUrl: (id: string, type: "aadhaar" | "pan" | "resume") =>
    `${BASE_URL}/employees/${id}/documents/${type}`,
  enrollFace: (id: string, photo: File) => {
    const form = new FormData();
    form.append("photo", photo);
    const token = getToken();
    return fetch(`${BASE_URL}/employees/${id}/face-enroll`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || "Face enrollment failed");
      return data;
    });
  },
};

export const attendanceAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/attendance${q}`);
  },
  mark: (body: object) =>
    request("/attendance", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/attendance/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  bulkMark: (body: object) =>
    request("/attendance/bulk", { method: "POST", body: JSON.stringify(body) }),
  getSummary: (params: Record<string, string>) =>
    request(`/attendance/summary?${new URLSearchParams(params).toString()}`),
};

export const leaveAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/leaves${q}`);
  },
  create: (body: object) =>
    request("/leaves", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/leaves/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  updateStatus: (id: string, body: object) =>
    request(`/leaves/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string, body?: object) =>
    request(`/leaves/${id}`, {
      method: "DELETE",
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
};

export const payrollAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/payroll${q}`);
  },
  getMy: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/payroll/my${q}`);
  },
  process: (body: object) =>
    request("/payroll/process", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/payroll/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  markPaid: (id: string, paymentMode?: string) =>
    request(`/payroll/${id}/paid`, {
      method: "PUT",
      body: JSON.stringify({ paymentMode }),
    }),
  bulkMarkPaid: (month: number, year: number, paymentMode?: string) =>
    request("/payroll/bulk-paid", {
      method: "POST",
      body: JSON.stringify({ month, year, paymentMode }),
    }),
  markSlipReceived: (id: string, status: "received" | "not_received") =>
    request(`/payroll/${id}/slip-received`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

export const recruitmentAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/recruitment${q}`);
  },
  create: (body: object) =>
    request("/recruitment", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/recruitment/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  addCandidate: (id: string, body: object) =>
    request(`/recruitment/${id}/candidates`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCandidateStage: (id: string, candidateId: string, body: object) =>
    request(`/recruitment/${id}/candidates/${candidateId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

export const departmentAPI = {
  getAll: () => request("/departments"),
  create: (body: object) =>
    request("/departments", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/departments/${id}`, { method: "DELETE" }),
};

export const performanceAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/performance${q}`);
  },
  create: (body: object) =>
    request("/performance", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/performance/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

export const settingsAPI = {
  get: () => request<{ success: boolean; data: any }>("/settings"),
  update: (settings: any) =>
    request<{ success: boolean; data: any }>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  uploadLogo: (file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append("logo", file);
    return fetch(`${BASE_URL}/settings/logo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      return data as { success: boolean; logoUrl: string; data: any };
    });
  },
  uploadPaymentQr: (file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append("qrCode", file);
    return fetch(`${BASE_URL}/settings/payment-qr`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      return data as { success: boolean; paymentQrUrl: string; data: any };
    });
  },
};

export const billingAPI = {
  getPlans: () => request<{ success: boolean; data: any }>("/billing/plans"),
  getSubscription: () =>
    request<{ success: boolean; data: any }>("/billing/subscription"),
  getInvoices: () =>
    request<{ success: boolean; data: any }>("/billing/invoices"),
  createOrder: (
    studentCount: number,
    billingCycle: "monthly" | "yearly",
    gateway: "razorpay" | "hdfc" = "razorpay",
    company?: {
      name: string;
      email: string;
      phone: string;
      industry: string;
      website: string;
      gstNumber: string;
      panNumber: string;
    },
    tier: "standard" | "whatsapp" = "standard",
  ) =>
    request<{ success: boolean; data: any }>("/billing/create-order", {
      method: "POST",
      body: JSON.stringify({
        studentCount,
        billingCycle,
        gateway,
        company,
        tier,
      }),
    }),
  verifyRazorpay: (payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) =>
    request<{ success: boolean; message: string; data: any }>(
      "/billing/verify-razorpay",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  verifyHdfc: (payload: { orderId: string; trackingId?: string | null }) =>
    request<{ success: boolean; message: string; data: any }>(
      "/billing/verify-hdfc",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  verifyPayment: (payload: {
    orderId?: string;
    trackingId?: string | null;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  }) =>
    request<{ success: boolean; message: string; data: any }>(
      "/billing/verify-payment",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),

  getPaymentMethods: () =>
    request<{ success: boolean; data: any }>("/payment-methods"),
  addPaymentMethod: (body: object) =>
    request<{ success: boolean; data: any }>("/payment-methods", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePaymentMethod: (id: string, body: object) =>
    request<{ success: boolean; data: any }>(`/payment-methods/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deletePaymentMethod: (id: string) =>
    request<{ success: boolean; data: any }>(`/payment-methods/${id}`, {
      method: "DELETE",
    }),
  getDefaultPaymentMethod: () =>
    request<{ success: boolean; data: any }>("/payment-methods/default"),
};

export const holidayAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/holidays${q}`);
  },
  create: (body: object) =>
    request("/holidays", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/holidays/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/holidays/${id}`, { method: "DELETE" }),
};

export const biometricAPI = {
  getLocations: () => request("/biometric/locations"),
  createLocation: (body: object) =>
    request("/biometric/locations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateLocation: (id: string, body: object) =>
    request(`/biometric/locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteLocation: (id: string) =>
    request(`/biometric/locations/${id}`, { method: "DELETE" }),

  getDevices: () => request("/biometric/devices"),
  createDevice: (body: object) =>
    request("/biometric/devices", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateDevice: (id: string, body: object) =>
    request(`/biometric/devices/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteDevice: (id: string) =>
    request(`/biometric/devices/${id}`, { method: "DELETE" }),
  regenerateDeviceToken: (id: string) =>
    request(`/biometric/devices/${id}/regenerate-token`, { method: "POST" }),

  assignNfcCard: (deviceId: string, body: object) =>
    request(`/biometric/devices/${deviceId}/nfc`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  removeNfcCard: (deviceId: string, uid: string) =>
    request(`/biometric/devices/${deviceId}/nfc/${uid}`, { method: "DELETE" }),

  getDeviceInfo: (token: string) =>
    fetch(`${BASE_URL}/biometric/device/${token}`).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Device error");
      return d;
    }),
  recordBiometric: (body: object) =>
    fetch(`${BASE_URL}/biometric/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Record failed");
      return d;
    }),

  getLogs: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/biometric/logs${q}`);
  },

  setDeviceSerial: (id: string, serialNumber: string) =>
    request(`/biometric/devices/${id}/serial`, {
      method: "PUT",
      body: JSON.stringify({ serialNumber }),
    }),
  syncEmployeeToDevice: (
    deviceId: string,
    employeeId: string,
    rfidCard?: string,
  ) =>
    request(`/biometric/devices/${deviceId}/sync-employee`, {
      method: "POST",
      body: JSON.stringify({ employeeId, rfidCard }),
    }),
  syncAllToDevice: (deviceId: string) =>
    request(`/biometric/devices/${deviceId}/sync-all`, { method: "POST" }),
  removeEmployeeFromDevice: (deviceId: string, employeeId: string) =>
    request(`/biometric/devices/${deviceId}/sync-employee/${employeeId}`, {
      method: "DELETE",
    }),
  getDeviceCommands: (deviceId: string) =>
    request(`/biometric/devices/${deviceId}/commands`),

  saveRfidCard: (employeeId: string, rfidCard: string) =>
    request(`/biometric/employees/${employeeId}/rfid`, {
      method: "POST",
      body: JSON.stringify({ rfidCard }),
    }),

  saveFaceDescriptor: (employeeId: string, descriptor: number[]) =>
    request(`/biometric/employees/${employeeId}/face`, {
      method: "POST",
      body: JSON.stringify({ descriptor }),
    }),
  getFaceDescriptors: () => request("/biometric/face-descriptors"),
  faceAttendance: (descriptor: number[], deviceToken?: string) =>
    request("/biometric/face-attendance", {
      method: "POST",
      body: JSON.stringify({ descriptor, deviceToken }),
    }),

  enrollFingerprint: (deviceId: string, employeeId: string, fingerIndex = 0) =>
    request(`/biometric/devices/${deviceId}/enroll-fingerprint`, {
      method: "POST",
      body: JSON.stringify({ employeeId, fingerIndex }),
    }),

  enrollFaceOnDevice: (deviceId: string, employeeId: string) =>
    request(`/biometric/devices/${deviceId}/enroll-face-device`, {
      method: "POST",
      body: JSON.stringify({ employeeId }),
    }),

  pushFaceTemplateToDevice: (deviceId: string, employeeId: string) =>
    request(`/biometric/devices/${deviceId}/push-face-template`, {
      method: "POST",
      body: JSON.stringify({ employeeId }),
    }),

  getDeviceEmployees: (token: string) =>
    request(`/biometric/device/${token}/employees`),
  enrollFaceFromDevice: (
    deviceToken: string,
    employeeId: string,
    descriptor: number[],
  ) =>
    request("/biometric/device-face-enroll", {
      method: "POST",
      body: JSON.stringify({ deviceToken, employeeId, descriptor }),
    }),
};

export const payrollConfigAPI = {
  getAllConfigs: () => request("/payroll-config/employee-configs"),
  getConfig: (employeeId: string) =>
    request(`/payroll-config/employee-configs/${employeeId}`),
  upsertConfig: (employeeId: string, body: object) =>
    request(`/payroll-config/employee-configs/${employeeId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getDeductionRules: () => request("/payroll-config/deduction-rules"),
  upsertDeductionRules: (body: object) =>
    request("/payroll-config/deduction-rules", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

export const companyAPI = {
  getMe: () => request<{ success: boolean; data: any }>("/company/me"),
  update: (body: object) =>
    request<{ success: boolean; data: any }>("/company", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

export const loanAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/loans${q}`);
  },
  create: (body: object) =>
    request("/loans", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/loans/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  updateStatus: (id: string, body: object) =>
    request(`/loans/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/loans/${id}`, { method: "DELETE" }),
};

export const branchAPI = {
  getAll: () => request("/branches"),
  create: (body: object) =>
    request("/branches", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/branches/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/branches/${id}`, { method: "DELETE" }),
};

export const shiftAPI = {
  getAll: () => request("/shifts"),
  create: (body: object) =>
    request("/shifts", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/shifts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/shifts/${id}`, { method: "DELETE" }),
};

export const salaryHeadAPI = {
  getAll: () => request("/salary-heads"),
  create: (body: object) =>
    request("/salary-heads", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/salary-heads/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/salary-heads/${id}`, { method: "DELETE" }),
};

export const designationAPI = {
  getAll: () => request("/designations"),
  create: (body: object) =>
    request("/designations", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/designations/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/designations/${id}`, { method: "DELETE" }),
};

export const offerLetterAPI = {
  getAll: () => request("/offer-letters"),
  create: (body: object) =>
    request("/offer-letters", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/offer-letters/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/offer-letters/${id}`, { method: "DELETE" }),
};

export const transactionAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/transactions${q}`);
  },
  create: (body: object) =>
    request("/transactions", { method: "POST", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/transactions/${id}`, { method: "DELETE" }),
};

export const exitAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/exit${q}`);
  },
  getOne: (id: string) => request(`/exit/${id}`),
  create: (body: object) =>
    request("/exit", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/exit/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/exit/${id}`, { method: "DELETE" }),
};

export const auditAPI = {
  getLogs: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/audit${q}`);
  },
};

export const supportAPI = {
  getAll: () => request("/support"),
  getOne: (id: string) => request(`/support/${id}`),
  create: (body: {
    subject: string;
    issueType: string;
    priority: string;
    description: string;
  }) => request("/support", { method: "POST", body: JSON.stringify(body) }),
  reply: (id: string, message: string) =>
    request(`/support/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  close: (id: string) => request(`/support/${id}/close`, { method: "POST" }),
};

export const documentAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/documents${q}`);
  },
  upload: (body: {
    employeeId?: string;
    name: string;
    docType: string;
    mimeType: string;
    fileData: string;
  }) => request("/documents", { method: "POST", body: JSON.stringify(body) }),
  download: (id: string) => request(`/documents/${id}/download`),
  delete: (id: string) => request(`/documents/${id}`, { method: "DELETE" }),
};

export const payrollPreviewAPI = {
  preview: (body: { month: number; year: number; employeeIds?: string[] }) =>
    request("/payroll/preview", { method: "POST", body: JSON.stringify(body) }),
};

export const assetAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/assets${q}`);
  },
  create: (body: {
    name: string;
    assetType: string;
    serialNumber: string;
    employeeId?: string;
  }) => request("/assets", { method: "POST", body: JSON.stringify(body) }),
  assign: (id: string, employeeId: string, notes?: string) =>
    request(`/assets/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ employeeId, notes }),
    }),
  return: (id: string) => request(`/assets/${id}/return`, { method: "POST" }),
  delete: (id: string) => request(`/assets/${id}`, { method: "DELETE" }),
};

export const announcementAPI = {
  getAll: () => request("/announcements"),
  create: (body: { title: string; content: string }) =>
    request("/announcements", { method: "POST", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/announcements/${id}`, { method: "DELETE" }),
};

export const attendanceCorrectionAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/attendance-corrections${q}`);
  },
  create: (body: {
    date: string;
    type: "regularization" | "missed_punch";
    checkIn?: string;
    checkOut?: string;
    reason: string;
  }) =>
    request("/attendance-corrections", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateStatus: (
    id: string,
    status: "approved" | "rejected",
    rejectionReason?: string,
  ) =>
    request(`/attendance-corrections/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, rejectionReason }),
    }),
};

// ── NestSports domain APIs ──────────────────────────────────────────────

export const studentAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/students${q}`);
  },
  getOne: (id: string) => request(`/students/${id}`),
  create: (body: object) =>
    request("/students", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/students/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/students/${id}`, { method: "DELETE" }),
  uploadAvatar: (id: string, file: File) => {
    const form = new FormData();
    form.append("avatar", file);
    const token = getToken();
    return fetch(`${BASE_URL}/students/${id}/avatar`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || "Photo upload failed");
      return data;
    });
  },
  uploadGuardianPhoto: (studentId: string, guardianId: string, file: File) => {
    const form = new FormData();
    form.append("photo", file);
    const token = getToken();
    return fetch(
      `${BASE_URL}/students/${studentId}/guardians/${guardianId}/photo`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      },
    ).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || "Photo upload failed");
      return data;
    });
  },
};

export const studentAttendanceAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/student-attendance${q}`);
  },
  mark: (body: object) =>
    request("/student-attendance", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  bulkMark: (body: object) =>
    request("/student-attendance/bulk", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const sportAPI = {
  getAll: () => request("/sports"),
  create: (body: object) =>
    request("/sports", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/sports/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/sports/${id}`, { method: "DELETE" }),
};

export const sportsPlanAPI = {
  getAll: () => request("/plans"),
  create: (body: object) =>
    request("/plans", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/plans/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/plans/${id}`, { method: "DELETE" }),
};

export const tournamentAPI = {
  getAll: () => request("/tournaments"),
  getOne: (id: string) => request(`/tournaments/${id}`),
  create: (body: object) =>
    request("/tournaments", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/tournaments/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/tournaments/${id}`, { method: "DELETE" }),
  addTeam: (id: string, name: string) =>
    request(`/tournaments/${id}/teams`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  removeTeam: (id: string, teamId: string) =>
    request(`/tournaments/${id}/teams/${teamId}`, { method: "DELETE" }),
  generateFixtures: (
    id: string,
    opts?: { regenerate?: boolean; shuffle?: boolean },
  ) =>
    request(`/tournaments/${id}/fixtures/generate`, {
      method: "POST",
      body: JSON.stringify(opts || {}),
    }),
  getFixtures: (id: string) => request(`/tournaments/${id}/fixtures`),
  recordResult: (
    fixtureId: string,
    body: { scoreA?: number; scoreB?: number; winner?: "A" | "B" },
  ) =>
    request(`/tournaments/fixtures/${fixtureId}/result`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  register: (id: string, studentId: string) =>
    request(`/tournaments/${id}/registrations`, {
      method: "POST",
      body: JSON.stringify({ studentId }),
    }),
  unregister: (id: string, studentId: string) =>
    request(`/tournaments/${id}/registrations/${studentId}`, { method: "DELETE" }),
};

export const subscriptionAPI = {
  getAll: () => request("/subscriptions"),
  createOrder: (body: {
    studentId: string;
    planId: string;
    billingCycle?: string;
  }) =>
    request("/subscriptions/create-order", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  verifyPayment: (body: object) =>
    request("/subscriptions/verify-payment", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  confirmQrPayment: (id: string) =>
    request(`/subscriptions/${id}/confirm-qr-payment`, { method: "POST" }),
  cancel: (id: string) =>
    request(`/subscriptions/${id}/cancel`, { method: "POST" }),
  qrRenewal: (body: {
    studentId: string;
    planId: string;
    billingCycle?: string;
    referenceNumber: string;
    screenshot: File;
  }) => {
    const form = new FormData();
    form.append("studentId", body.studentId);
    form.append("planId", body.planId);
    form.append("billingCycle", body.billingCycle || "monthly");
    form.append("referenceNumber", body.referenceNumber);
    form.append("screenshot", body.screenshot);
    const token = getToken();
    return fetch(`${BASE_URL}/subscriptions/qr-renewal`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || "Submission failed");
      return data;
    });
  },
};

export const expenseAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/expenses${q}`);
  },
  create: (body: object) =>
    request("/expenses", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/expenses/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/expenses/${id}`, { method: "DELETE" }),
};

export const inventoryAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/inventory${q}`);
  },
  create: (body: object) =>
    request("/inventory", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/inventory/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/inventory/${id}`, { method: "DELETE" }),
  recordTransaction: (id: string, body: object) =>
    request(`/inventory/${id}/transactions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  assign: (id: string, body: object) =>
    request(`/inventory/${id}/assign`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  returnAssignment: (id: string, assignmentId: string) =>
    request(`/inventory/${id}/assignments/${assignmentId}/return`, {
      method: "POST",
    }),
};

export const facilityAPI = {
  getAll: () => request("/facilities"),
  create: (body: object) =>
    request("/facilities", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/facilities/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/facilities/${id}`, { method: "DELETE" }),
};

export const bookingAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/bookings${q}`);
  },
  create: (body: object) =>
    request("/bookings", { method: "POST", body: JSON.stringify(body) }),
  verifyPayment: (body: object) =>
    request("/bookings/verify-payment", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cancel: (id: string) => request(`/bookings/${id}/cancel`, { method: "POST" }),
};
