import api from "./api";
import { PaginatedResponse } from "./assetService";

// ---------------------------------------------------------------------------
// Admin review types
// ---------------------------------------------------------------------------

export interface AdminVerificationRequest {
  id: string;
  source_type: "employee_verification";
  reference_code: string;
  cycleName: string;
  cycleCode: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  locationScopeId: string | null;
  locationScopeName: string | null;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  otp_verified_at: string | null;
  submitted_at: string | null;
  expires_at: string | null;
  created_at: string;
  assetCount: number;
  verifiedCount: number;
  issueCount: number;
  declarationPresent: boolean;
}

export interface VerificationAssetPhoto {
  id: string;
  url: string;
  uploaded_at: string;
}

export interface AdminVerificationRequestDetail extends AdminVerificationRequest {
  request_assets: {
    id: string;
    assetId: string;
    name: string;
    serialNumber: string | null;
    categoryName: string | null;
    locationName: string | null;
    sort_order: number;
    photos: VerificationAssetPhoto[];
    response: {
      response: string;
      remarks: string | null;
      responded_at: string | null;
      issue: { issue_type: string; description: string } | null;
    } | null;
  }[];
  declaration: {
    id: string;
    declared_by_name: string;
    declared_by_email: string;
    consented_at: string;
    consent_text_version: string | null;
  } | null;
}

export async function fetchAdminVerificationRequests(
  params: Record<string, any> = {}
): Promise<PaginatedResponse<AdminVerificationRequest>> {
  const { data } = await api.get("/verification/requests/", { params });
  return data;
}

export async function fetchVerificationRequestDetail(
  id: string
): Promise<AdminVerificationRequestDetail> {
  const { data } = await api.get(`/verification/requests/${id}/`);
  return data;
}

export async function quickSendVerification(assetId: string) {
  const { data } = await api.post("/verification/requests/quick-send/", {
    asset_id: assetId,
  });
  return data;
}

// ---------------------------------------------------------------------------
// Public portal functions
// ---------------------------------------------------------------------------

export async function fetchPublicRequest(token: string) {
  const { data } = await api.get(`/verification/public/${token}/`);
  return data;
}

export async function sendPublicOtp(token: string) {
  const { data } = await api.post(`/verification/public/${token}/otp/send/`);
  return data as { challenge_id: string; debug_otp?: string };
}

export async function verifyPublicOtp(token: string, challengeId: string, otp: string) {
  const { data } = await api.post(`/verification/public/${token}/otp/verify/`, {
    challenge_id: challengeId,
    otp,
  });
  return data as { detail: string; status: string };
}

export interface AssetResponse {
  request_asset_id: string;
  response: "verified" | "issue_reported";
  remarks?: string;
  issue_type?: string;
  issue_description?: string;
}

export interface SubmitVerificationPayload {
  responses: AssetResponse[];
  declared_by_name: string;
  declared_by_email: string;
  consent_text_version?: string;
}

export async function submitPublicVerification(token: string, payload: SubmitVerificationPayload) {
  const { data } = await api.post(`/verification/public/${token}/submit/`, payload);
  return data;
}

export async function uploadAssetPhoto(
  token: string,
  requestAssetId: string,
  file: File
): Promise<VerificationAssetPhoto> {
  const fd = new FormData();
  fd.append("photo", file);
  const { data } = await api.post(
    `/verification/public/${token}/assets/${requestAssetId}/photos/`,
    fd,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data as VerificationAssetPhoto;
}

export async function addMissingAsset(payload: Record<string, any>) {
  const { data } = await api.post("/employee/add-missing-asset", payload);
  return data;
}

export interface VerificationCycle {
  id: string;
  name: string;
  code: string;
  status: string;
  start_date: string;
  end_date: string;
  description?: string;
}

export async function fetchVerificationCycles(params?: { status?: string }): Promise<VerificationCycle[]> {
  const { data } = await api.get("/verification/cycles/", { params });
  return data;
}

export async function sendVerificationRequest(payload: Record<string, any>) {
  const { data } = await api.post("/admin/send-verification-request", payload);
  return data;
}
