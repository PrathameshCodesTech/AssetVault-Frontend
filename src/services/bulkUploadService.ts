import api from "./api";

export async function uploadPreview(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post("/assets/upload/preview/", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function processJob(jobId: string) {
  const { data } = await api.post("/assets/upload/process/", { job_id: jobId });
  return data;
}

export async function fetchJobDetail(jobId: string) {
  const { data } = await api.get(`/assets/upload/jobs/${jobId}/`);
  return data;
}

export async function fetchJobRows(jobId: string, params: Record<string, any> = {}) {
  const { data } = await api.get(`/assets/upload/jobs/${jobId}/rows/`, { params });
  return data;
}
