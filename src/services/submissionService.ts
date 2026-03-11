import api from "./api";
import { PaginatedResponse } from "./assetService";

export interface SubmissionListParams {
  page?: number;
  page_size?: number;
  status?: string;
  type?: string;
}

export async function fetchMySubmissions(params: SubmissionListParams = {}) {
  const { data } = await api.get("/third-party/submissions/", { params });
  return data as PaginatedResponse<any>;
}

export async function fetchSubmission(id: string) {
  const { data } = await api.get(`/third-party/submissions/${id}/`);
  return data;
}

export async function fetchAdminSubmissions(params: SubmissionListParams = {}) {
  const { data } = await api.get("/admin/submissions/", { params });
  return data as PaginatedResponse<any>;
}

export async function fetchAdminSubmission(id: string) {
  const { data } = await api.get(`/admin/submissions/${id}/`);
  return data;
}

export async function approveSubmission(id: string, reviewNotes = "") {
  const { data } = await api.post(`/admin/submissions/${id}/approve/`, { review_notes: reviewNotes });
  return data;
}

export async function rejectSubmission(id: string, reviewNotes = "") {
  const { data } = await api.post(`/admin/submissions/${id}/reject/`, { review_notes: reviewNotes });
  return data;
}

export async function requestCorrection(id: string, reviewNotes = "") {
  const { data } = await api.post(`/admin/submissions/${id}/correction/`, { review_notes: reviewNotes });
  return data;
}

export async function convertToAsset(id: string, payload: Record<string, any>) {
  const { data } = await api.post(`/admin/submissions/${id}/convert-to-asset/`, payload);
  return data;
}

export async function thirdPartyVerify(payload: FormData | Record<string, any>) {
  const isFormData = payload instanceof FormData;
  const { data } = await api.post("/third-party/verify", payload, isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : {});
  return data;
}

export async function thirdPartyAddAsset(payload: FormData | Record<string, any>) {
  const isFormData = payload instanceof FormData;
  const { data } = await api.post("/third-party/add-asset", payload, isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : {});
  return data;
}

export async function reconciliationSubmit(payload: FormData | Record<string, any>) {
  const isFormData = payload instanceof FormData;
  const { data } = await api.post("/reconciliation/submit", payload, isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : {});
  return data;
}
