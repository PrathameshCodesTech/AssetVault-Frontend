import api from "./api";

// ---------------------------------------------------------------------------
// Interfaces — all IDs are UUID strings
// ---------------------------------------------------------------------------

export interface VendorOrganization {
  id: string;
  code: string;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
  is_active: boolean;
  user_count: number;
  request_count: number;
  created_at: string;
}

export interface VendorOrganizationCreate {
  code: string;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
}

export interface VendorUserAssignment {
  id: string;
  vendor_id: string;
  vendor_name: string;
  user_id: string;
  user_email: string;
  user_name: string;
  is_active: boolean;
  created_at: string;
}

export interface VendorRequestAssetPhoto {
  id: string;
  image_url: string | null;
  uploaded_at: string;
}

export interface VendorRequestAsset {
  id: string;
  asset_id: string;
  asset_id_snapshot: string;
  asset_name_snapshot: string;
  asset_location_snapshot: string;
  response_status: 'pending' | 'confirmed' | 'issue_reported';
  response_notes?: string;
  observed_location_id?: string | null;
  observed_location_name?: string | null;
  responded_at?: string | null;
  admin_decision: 'pending_review' | 'approved' | 'correction_required';
  photos: VendorRequestAssetPhoto[];
}

export interface VendorVerificationRequest {
  id: string;
  reference_code: string;
  vendor_id: string;
  vendor_name: string;
  requested_by_id: string;
  requested_by_email: string;
  location_scope_id?: string | null;
  status: 'draft' | 'sent' | 'in_progress' | 'submitted' | 'correction_requested' | 'approved' | 'cancelled';
  notes?: string;
  review_notes?: string;
  sent_at?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  asset_count: number;
  pending_count: number;
  approved_count: number;
  correction_count: number;
  pending_review_count: number;
  created_at: string;
}

export interface VendorVerificationRequestDetail extends VendorVerificationRequest {
  request_assets: VendorRequestAsset[];
}

export interface VendorRequestCreate {
  vendor_id: string;
  asset_ids: string[];
  location_scope_id?: string | null;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Superadmin: Vendor Organization APIs
// ---------------------------------------------------------------------------

export async function fetchVendors(params?: { is_active?: boolean }): Promise<VendorOrganization[]> {
  const { data } = await api.get("/admin/vendors/", { params });
  return (data.results ?? data) as VendorOrganization[];
}

export async function createVendor(payload: VendorOrganizationCreate): Promise<VendorOrganization> {
  const { data } = await api.post("/admin/vendors/", payload);
  return data as VendorOrganization;
}

export async function updateVendor(id: string, payload: Partial<VendorOrganizationCreate & { is_active: boolean }>): Promise<VendorOrganization> {
  const { data } = await api.patch(`/admin/vendors/${id}/`, payload);
  return data as VendorOrganization;
}

export async function fetchVendorUsers(vendorId: string): Promise<VendorUserAssignment[]> {
  const { data } = await api.get(`/admin/vendors/${vendorId}/users/`);
  return (data.results ?? data) as VendorUserAssignment[];
}

export async function addVendorUser(vendorId: string, userId: string): Promise<VendorUserAssignment> {
  const { data } = await api.post(`/admin/vendors/${vendorId}/users/`, { user_id: userId });
  return data as VendorUserAssignment;
}

export async function removeVendorUser(vendorId: string, assignmentId: string): Promise<void> {
  await api.delete(`/admin/vendors/${vendorId}/users/${assignmentId}/`);
}

// ---------------------------------------------------------------------------
// Admin: Vendor Verification Request APIs
// ---------------------------------------------------------------------------

export async function fetchAdminVendorRequests(params?: { vendor_id?: string; status?: string }): Promise<VendorVerificationRequest[]> {
  const { data } = await api.get("/admin/vendor-requests/", { params });
  return (data.results ?? data) as VendorVerificationRequest[];
}

export async function fetchAdminVendorRequest(id: string): Promise<VendorVerificationRequestDetail> {
  const { data } = await api.get(`/admin/vendor-requests/${id}/`);
  return data as VendorVerificationRequestDetail;
}

export async function createVendorRequest(payload: VendorRequestCreate): Promise<VendorVerificationRequestDetail> {
  const { data } = await api.post("/admin/vendor-requests/", payload);
  return data as VendorVerificationRequestDetail;
}

export async function sendVendorRequest(id: string): Promise<VendorVerificationRequest> {
  const { data } = await api.post(`/admin/vendor-requests/${id}/send/`);
  return data as VendorVerificationRequest;
}

export async function approveVendorRequest(id: string, reviewNotes?: string): Promise<VendorVerificationRequestDetail> {
  const { data } = await api.post(`/admin/vendor-requests/${id}/approve/`, { review_notes: reviewNotes });
  return data as VendorVerificationRequestDetail;
}

export async function requestCorrectionVendorRequest(
  id: string,
  reviewNotes: string,
  assetDecisions?: Array<{ request_asset_id: string; decision: string; notes?: string }>
): Promise<VendorVerificationRequestDetail> {
  const { data } = await api.post(`/admin/vendor-requests/${id}/correction/`, {
    review_notes: reviewNotes,
    asset_decisions: assetDecisions ?? [],
  });
  return data as VendorVerificationRequestDetail;
}

export async function setAssetAdminDecision(
  requestId: string,
  assetPk: string,
  decision: string,
  notes?: string
): Promise<VendorRequestAsset> {
  const { data } = await api.patch(`/admin/vendor-requests/${requestId}/assets/${assetPk}/decision/`, {
    admin_decision: decision,
    response_notes: notes,
  });
  return data as VendorRequestAsset;
}

export async function removeAssetFromDraftRequest(requestId: string, assetPk: string): Promise<{ detail?: string } | null> {
  const res = await api.delete(`/admin/vendor-requests/${requestId}/assets/${assetPk}/`);
  return res.status === 204 ? null : (res.data as { detail?: string });
}

export async function cancelVendorRequest(id: string): Promise<VendorVerificationRequest> {
  const { data } = await api.post(`/admin/vendor-requests/${id}/cancel/`);
  return data as VendorVerificationRequest;
}

// ---------------------------------------------------------------------------
// Vendor-facing APIs
// ---------------------------------------------------------------------------

export async function fetchVendorRequests(params?: { status?: string }): Promise<VendorVerificationRequest[]> {
  const { data } = await api.get("/vendor/requests/", { params });
  return (data.results ?? data) as VendorVerificationRequest[];
}

export async function fetchVendorRequestDetail(id: string): Promise<VendorVerificationRequestDetail> {
  const { data } = await api.get(`/vendor/requests/${id}/`);
  return data as VendorVerificationRequestDetail;
}

export async function updateVendorRequestAsset(
  requestId: string,
  assetPk: string,
  payload: { response_status?: string; response_notes?: string; observed_location_id?: string | null }
): Promise<VendorRequestAsset> {
  const { data } = await api.patch(`/vendor/requests/${requestId}/assets/${assetPk}/`, payload);
  return data as VendorRequestAsset;
}

export async function uploadVendorAssetPhoto(requestId: string, assetPk: string, image: File): Promise<VendorRequestAssetPhoto> {
  const form = new FormData();
  form.append("image", image);
  const { data } = await api.post(`/vendor/requests/${requestId}/assets/${assetPk}/photos/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as VendorRequestAssetPhoto;
}

export async function submitVendorRequest(id: string): Promise<VendorVerificationRequest> {
  const { data } = await api.post(`/vendor/requests/${id}/submit/`);
  return data as VendorVerificationRequest;
}

export async function scanVendorRequestAsset(
  requestId: string,
  params: { qr_uid?: string; asset_id?: string; tag_number?: string }
): Promise<{ in_package: boolean; request_asset_id?: string; asset_id?: string; asset_name?: string; response_status?: string; admin_decision?: string; detail?: string }> {
  const { data } = await api.get(`/vendor/requests/${requestId}/scan/`, { params });
  return data;
}

export interface VendorGlobalScanResult {
  matched: boolean;
  in_package: boolean;
  request_id?: string;
  request_reference?: string;
  request_asset_id?: string;
  asset_id?: string;
  asset_name?: string;
  status?: string;
  editable?: boolean;
  detail?: string;
}

export async function vendorGlobalScan(
  params: { qr_uid?: string; asset_id?: string; tag_number?: string }
): Promise<VendorGlobalScanResult> {
  const { data } = await api.post('/vendor/requests/scan/', params);
  return data;
}
