import api from "./api";

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AssetListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  category?: string;
  reconciliation_status?: string;
  location_id?: string;
  assigned_to?: string;
  is_mapped?: string;
  entity?: string;
  ordering?: string;
}

export async function fetchAssets(params: AssetListParams = {}) {
  const { data } = await api.get("/assets/", { params });
  return data as PaginatedResponse<any>;
}

export async function fetchAsset(id: string) {
  const { data } = await api.get(`/assets/${id}/`);
  return data;
}

export async function createAsset(payload: Record<string, any>, imageFile?: File | null) {
  if (imageFile) {
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') fd.append(k, String(v));
    });
    fd.append('image', imageFile);
    const { data } = await api.post('/assets/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }
  const { data } = await api.post('/assets/', payload);
  return data;
}

export async function updateAsset(id: string, payload: Record<string, any>) {
  const { data } = await api.patch(`/assets/${id}/`, payload);
  return data;
}

export async function fetchAssetHistory(id: string) {
  const { data } = await api.get(`/assets/${id}/history/`);
  return data as any[];
}

export async function assignAsset(id: string, payload: { user_id: string; note?: string; force_reassign?: boolean }) {
  const { data } = await api.post(`/assets/${id}/assign/`, payload);
  return data;
}

export async function moveAsset(id: string, payload: { to_location_id: string; note?: string }) {
  const { data } = await api.post(`/assets/${id}/move/`, payload);
  return data;
}

export async function scanAsset(qrUid: string) {
  const { data } = await api.get(`/assets/scan/${qrUid}/`);
  return data;
}

export async function fetchLookups() {
  const { data } = await api.get("/assets/lookups/");
  return data;
}

export async function generateQr(assetId: string) {
  const { data } = await api.get("/assets/generate-qr", { params: { asset_id: assetId } });
  return data;
}

export interface UserOption {
  id: string;
  email: string;
  name: string;
}

export async function fetchUsers(search?: string): Promise<UserOption[]> {
  const params: Record<string, string> = {};
  if (search) params.search = search;
  const { data } = await api.get("/auth/users/", { params });
  return (data.results ?? data) as UserOption[];
}
