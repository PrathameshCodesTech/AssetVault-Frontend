const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const API_ENDPOINTS = {
  auth: {
    sendOtp: `${API_BASE_URL}/auth/send-otp`,
    verifyOtp: `${API_BASE_URL}/auth/verify-otp`,
    logout: `${API_BASE_URL}/auth/logout`,
    me: `${API_BASE_URL}/auth/me`,
    refresh: `${API_BASE_URL}/auth/refresh`,
  },
  assets: {
    list: `${API_BASE_URL}/assets/`,
    create: `${API_BASE_URL}/assets/`,
    detail: (id: string) => `${API_BASE_URL}/assets/${id}/`,
    history: (id: string) => `${API_BASE_URL}/assets/${id}/history/`,
    assign: (id: string) => `${API_BASE_URL}/assets/${id}/assign/`,
    move: (id: string) => `${API_BASE_URL}/assets/${id}/move/`,
    qr: (id: string) => `${API_BASE_URL}/assets/${id}/qr/`,
    scan: (qrUid: string) => `${API_BASE_URL}/assets/scan/${qrUid}/`,
    lookups: `${API_BASE_URL}/assets/lookups/`,
    generateQr: `${API_BASE_URL}/assets/generate-qr`,
    uploadPreview: `${API_BASE_URL}/assets/upload/preview/`,
    uploadProcess: `${API_BASE_URL}/assets/upload/process/`,
    uploadJob: (id: string) => `${API_BASE_URL}/assets/upload/jobs/${id}/`,
    uploadJobRows: (id: string) => `${API_BASE_URL}/assets/upload/jobs/${id}/rows/`,
  },
  dashboard: {
    summary: `${API_BASE_URL}/dashboard/summary`,
  },
  reconciliation: {
    submit: `${API_BASE_URL}/reconciliation/submit`,
    report: `${API_BASE_URL}/reconciliation/report`,
  },
  reports: {
    reconciliation: `${API_BASE_URL}/reports/reconciliation`,
    discrepancy: `${API_BASE_URL}/reports/discrepancy`,
    audit: `${API_BASE_URL}/reports/audit`,
  },
  locations: {
    hierarchy: `${API_BASE_URL}/locations/hierarchy`,
    tree: `${API_BASE_URL}/locations/tree/`,
    nodes: `${API_BASE_URL}/locations/nodes/`,
    byLevel: (level: string) => `${API_BASE_URL}/locations/${level}/`,
  },
  admin: {
    sendVerificationRequest: `${API_BASE_URL}/admin/send-verification-request`,
  },
  verification: {
    requests: `${API_BASE_URL}/verification/requests/`,
    publicRequest: (token: string) => `${API_BASE_URL}/verification/public/${token}/`,
    publicOtpSend: (token: string) => `${API_BASE_URL}/verification/public/${token}/otp/send/`,
    publicOtpVerify: (token: string) => `${API_BASE_URL}/verification/public/${token}/otp/verify/`,
    publicSubmit: (token: string) => `${API_BASE_URL}/verification/public/${token}/submit/`,
  },
  employee: {
    verifyAssets: `${API_BASE_URL}/employee/verify-assets`,
    addMissingAsset: `${API_BASE_URL}/employee/add-missing-asset`,
    submitVerification: `${API_BASE_URL}/employee/submit-verification`,
  },
} as const;
