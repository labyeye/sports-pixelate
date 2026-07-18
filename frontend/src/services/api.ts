const BASE_URL = import.meta.env.VITE_API_URL;

export const getToken = () => localStorage.getItem("hrms_token");
export const setToken = (t: string) => localStorage.setItem("hrms_token", t);
export const removeToken = () => localStorage.removeItem("hrms_token");

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      // FormData bodies must NOT get a manual Content-Type — the browser
      // sets the multipart boundary itself when the header is left off.
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
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
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/departments${q}`);
  },
  getOne: (id: string) => request(`/departments/${id}`),
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
    employeeCount: number,
    wantsWhatsapp: boolean,
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
    offerCode?: string,
  ) =>
    request<{ success: boolean; data: any }>("/billing/create-order", {
      method: "POST",
      body: JSON.stringify({
        studentCount,
        employeeCount,
        wantsWhatsapp,
        billingCycle,
        gateway,
        company,
        offerCode: offerCode || undefined,
      }),
    }),
  validateOfferCode: (
    code: string,
    studentCount?: number,
    employeeCount?: number,
    wantsWhatsapp?: boolean,
  ) =>
    request<{ success: boolean; message: string; data: any }>(
      "/billing/validate-offer",
      {
        method: "POST",
        body: JSON.stringify({ code, studentCount, employeeCount, wantsWhatsapp }),
      },
    ),
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

export type PersonType = "employee" | "student";

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

  assignNfcCard: (
    deviceId: string,
    uid: string,
    personType: PersonType,
    personId: string,
    label?: string,
  ) =>
    request(`/biometric/devices/${deviceId}/nfc`, {
      method: "POST",
      body: JSON.stringify({ uid, personType, personId, label }),
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
  syncPersonToDevice: (
    deviceId: string,
    personType: PersonType,
    personId: string,
    rfidCard?: string,
  ) =>
    request(`/biometric/devices/${deviceId}/sync-person`, {
      method: "POST",
      body: JSON.stringify({ personType, personId, rfidCard }),
    }),
  syncAllToDevice: (deviceId: string) =>
    request(`/biometric/devices/${deviceId}/sync-all`, { method: "POST" }),
  removePersonFromDevice: (
    deviceId: string,
    personType: PersonType,
    personId: string,
  ) =>
    request(
      `/biometric/devices/${deviceId}/sync-person/${personType}/${personId}`,
      { method: "DELETE" },
    ),
  getDeviceCommands: (deviceId: string) =>
    request(`/biometric/devices/${deviceId}/commands`),

  assignBiometricUserId: (
    personType: PersonType,
    personId: string,
    biometricUserId: string,
  ) =>
    request(`/biometric/people/${personType}/${personId}/biometric-id`, {
      method: "POST",
      body: JSON.stringify({ biometricUserId }),
    }),

  saveRfidCard: (personType: PersonType, personId: string, rfidCard: string) =>
    request(`/biometric/people/${personType}/${personId}/rfid`, {
      method: "POST",
      body: JSON.stringify({ rfidCard }),
    }),

  saveFaceDescriptor: (
    personType: PersonType,
    personId: string,
    descriptor: number[],
  ) =>
    request(`/biometric/people/${personType}/${personId}/face`, {
      method: "POST",
      body: JSON.stringify({ descriptor }),
    }),
  getFaceDescriptors: () => request("/biometric/face-descriptors"),
  faceAttendance: (descriptor: number[], deviceToken?: string) =>
    request("/biometric/face-attendance", {
      method: "POST",
      body: JSON.stringify({ descriptor, deviceToken }),
    }),

  enrollFingerprint: (
    deviceId: string,
    personType: PersonType,
    personId: string,
    fingerIndex = 0,
  ) =>
    request(`/biometric/devices/${deviceId}/enroll-fingerprint`, {
      method: "POST",
      body: JSON.stringify({ personType, personId, fingerIndex }),
    }),

  enrollFaceOnDevice: (
    deviceId: string,
    personType: PersonType,
    personId: string,
  ) =>
    request(`/biometric/devices/${deviceId}/enroll-face-device`, {
      method: "POST",
      body: JSON.stringify({ personType, personId }),
    }),

  pushFaceTemplateToDevice: (
    deviceId: string,
    personType: PersonType,
    personId: string,
  ) =>
    request(`/biometric/devices/${deviceId}/push-face-template`, {
      method: "POST",
      body: JSON.stringify({ personType, personId }),
    }),

  getDevicePeople: (token: string) =>
    request(`/biometric/device/${token}/people`),
  enrollFaceFromDevice: (
    deviceToken: string,
    personType: PersonType,
    personId: string,
    descriptor: number[],
  ) =>
    request("/biometric/device-face-enroll", {
      method: "POST",
      body: JSON.stringify({ deviceToken, personType, personId, descriptor }),
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
};

export const attendanceSettingsAPI = {
  get: () => request("/attendance-settings"),
  update: (body: object) =>
    request("/attendance-settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  upsertLateAllowance: (body: {
    mode: "bulk" | "custom";
    bulkCount?: number;
    perEmployee?: { employee: string; count: number }[];
  }) =>
    request("/attendance-settings/late-allowance", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  upsertLeaveAllowance: (body: {
    leaveType: string;
    mode: "bulk" | "custom";
    bulkDays?: number;
    perEmployee?: { employee: string; days: number }[];
  }) =>
    request("/attendance-settings/leave-allowance", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getBalanceSummary: () => request("/attendance-settings/balance-summary"),
  getMyBalance: () => request("/attendance-settings/my-balance"),
};

export const lateApprovalAPI = {
  getAll: (status?: string) =>
    request(`/late-approvals${status ? `?status=${status}` : ""}`),
  resolve: (id: string, resolvedStatus: string) =>
    request(`/late-approvals/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolvedStatus }),
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
  bulkImport: (loans: object[]) =>
    request("/loans/bulk-import", {
      method: "POST",
      body: JSON.stringify({ loans }),
    }),
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
  bulkImport: (students: object[]) =>
    request("/students/bulk-import", {
      method: "POST",
      body: JSON.stringify({ students }),
    }),
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
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/plans${q}`);
  },
  create: (body: object) =>
    request("/plans", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/plans/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/plans/${id}`, { method: "DELETE" }),
  bulkImport: (plans: object[]) =>
    request("/plans/bulk-import", {
      method: "POST",
      body: JSON.stringify({ plans }),
    }),
};

export const eventAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/events${q}`);
  },
  getOne: (id: string) => request(`/events/${id}`),
  create: (body: object) =>
    request("/events", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/events/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/events/${id}`, { method: "DELETE" }),
  getDashboard: (id: string) => request(`/events/${id}/dashboard`),
  uploadImages: (id: string, files: { coverImage?: File; bannerImage?: File }) => {
    const form = new FormData();
    if (files.coverImage) form.append("coverImage", files.coverImage);
    if (files.bannerImage) form.append("bannerImage", files.bannerImage);
    return request(`/events/${id}/images`, { method: "POST", body: form });
  },
  addTeam: (id: string, name: string) =>
    request(`/events/${id}/teams`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  removeTeam: (id: string, teamId: string) =>
    request(`/events/${id}/teams/${teamId}`, { method: "DELETE" }),
  register: (id: string, studentId: string) =>
    request(`/events/${id}/registrations`, {
      method: "POST",
      body: JSON.stringify({ studentId }),
    }),
  unregister: (id: string, studentId: string) =>
    request(`/events/${id}/registrations/${studentId}`, { method: "DELETE" }),
  generateFixtures: (
    id: string,
    opts?: { regenerate?: boolean; shuffle?: boolean },
  ) =>
    request(`/events/${id}/fixtures/generate`, {
      method: "POST",
      body: JSON.stringify(opts || {}),
    }),
  getFixtures: (id: string) => request(`/events/${id}/fixtures`),
  recordResult: (
    fixtureId: string,
    body: { scoreA?: number; scoreB?: number; winner?: "A" | "B" },
  ) =>
    request(`/events/fixtures/${fixtureId}/result`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  addOfficial: (id: string, body: { name: string; role?: string; phone?: string; email?: string }) =>
    request(`/events/${id}/officials`, { method: "POST", body: JSON.stringify(body) }),
  updateOfficial: (id: string, officialId: string, body: object) =>
    request(`/events/${id}/officials/${officialId}`, { method: "PUT", body: JSON.stringify(body) }),
  removeOfficial: (id: string, officialId: string) =>
    request(`/events/${id}/officials/${officialId}`, { method: "DELETE" }),
  addDocument: (id: string, file: File, kind: string, label: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    form.append("label", label);
    return request(`/events/${id}/documents`, { method: "POST", body: form });
  },
  removeDocument: (id: string, docId: string) =>
    request(`/events/${id}/documents/${docId}`, { method: "DELETE" }),
  getGallery: (id: string) => request(`/events/${id}/gallery`),
  addGalleryItem: (id: string, photo: File, caption: string) => {
    const form = new FormData();
    form.append("photo", photo);
    form.append("caption", caption);
    return request(`/events/${id}/gallery`, { method: "POST", body: form });
  },
  deleteGalleryItem: (id: string, itemId: string) =>
    request(`/events/${id}/gallery/${itemId}`, { method: "DELETE" }),
  getAnnouncements: (id: string) => request(`/events/${id}/announcements`),
  createAnnouncement: (id: string, body: { title: string; message: string }) =>
    request(`/events/${id}/announcements`, { method: "POST", body: JSON.stringify(body) }),
  getPayments: (id: string) => request(`/events/${id}/payments`),
  getAttendance: (id: string) => request(`/events/${id}/attendance`),
};

export const reportAPI = {
  studentFees: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/reports/student-fees${q}`);
  },
  studentOutstanding: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/reports/student-outstanding${q}`);
  },
  studentPerformance: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/reports/student-performance${q}`);
  },
  studentEnrollment: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/reports/student-enrollment${q}`);
  },
  batchSummary: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/reports/batch-summary${q}`);
  },
  sportSummary: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/reports/sport-summary${q}`);
  },
  studentProfile: (studentId: string) =>
    request(`/reports/student-profile/${studentId}`),
};

export const subscriptionAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/subscriptions${q}`);
  },
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
  verifyQrPayment: (id: string, paymentId: string) =>
    request(`/subscriptions/${id}/payments/${paymentId}/verify`, {
      method: "POST",
    }),
  rejectQrPayment: (id: string, paymentId: string, reason?: string) =>
    request(`/subscriptions/${id}/payments/${paymentId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  cancel: (id: string) =>
    request(`/subscriptions/${id}/cancel`, { method: "POST" }),
  qrRenewal: (body: {
    studentId: string;
    planId: string;
    billingCycle?: string;
    referenceNumber: string;
    transactionNumber: string;
    amount?: number;
    screenshot: File;
  }) => {
    const form = new FormData();
    form.append("studentId", body.studentId);
    form.append("planId", body.planId);
    form.append("billingCycle", body.billingCycle || "monthly");
    form.append("referenceNumber", body.referenceNumber);
    form.append("transactionNumber", body.transactionNumber);
    if (body.amount !== undefined) form.append("amount", String(body.amount));
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
  // Top up the remaining balance on an existing subscription (installment).
  submitPayment: (
    id: string,
    body: {
      referenceNumber: string;
      transactionNumber: string;
      amount: number;
      screenshot: File;
    },
  ) => {
    const form = new FormData();
    form.append("referenceNumber", body.referenceNumber);
    form.append("transactionNumber", body.transactionNumber);
    form.append("amount", String(body.amount));
    form.append("screenshot", body.screenshot);
    const token = getToken();
    return fetch(`${BASE_URL}/subscriptions/${id}/payments`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || "Submission failed");
      return data;
    });
  },
  receiptUrl: (id: string, paymentId: string) =>
    `${BASE_URL}/subscriptions/${id}/payments/${paymentId}/receipt`,
  bulkImport: (subscriptions: object[]) =>
    request("/subscriptions/bulk-import", {
      method: "POST",
      body: JSON.stringify({ subscriptions }),
    }),
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
  bulkImport: (items: object[]) =>
    request("/inventory/bulk-import", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
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
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/facilities${q}`);
  },
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
