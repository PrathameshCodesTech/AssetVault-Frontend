import api from "./api";

export interface ReportParams {
  location_id?: string;
  date_from?: string;
  date_to?: string;
  export?: "csv";
  page?: number;
  page_size?: number;
}

export async function fetchReconciliationReport(params: ReportParams = {}) {
  const { data } = await api.get("/reports/reconciliation", { params });
  return data;
}

export async function fetchDiscrepancyReport(params: ReportParams = {}) {
  const { data } = await api.get("/reports/discrepancy", { params });
  return data;
}

export async function fetchAuditReport(params: ReportParams = {}) {
  const { data } = await api.get("/reports/audit", { params });
  return data;
}

export function getReconciliationCsvUrl(params: ReportParams = {}) {
  const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api") + "/reports/reconciliation";
  const search = new URLSearchParams({ ...params, export: "csv" } as any).toString();
  return `${base}?${search}`;
}

export function getDiscrepancyCsvUrl(params: ReportParams = {}) {
  const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api") + "/reports/discrepancy";
  const search = new URLSearchParams({ ...params, export: "csv" } as any).toString();
  return `${base}?${search}`;
}

export function getAuditCsvUrl(params: ReportParams = {}) {
  const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api") + "/reports/audit";
  const search = new URLSearchParams({ ...params, export: "csv" } as any).toString();
  return `${base}?${search}`;
}
