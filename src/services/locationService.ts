import api from "./api";

export async function fetchLocationTree() {
  const { data } = await api.get("/locations/tree/");
  return data as any[];
}

export async function fetchLocationHierarchy() {
  const { data } = await api.get("/locations/hierarchy");
  return data as any[];
}

export async function fetchLocationNodes(params: Record<string, string> = {}) {
  const { data } = await api.get("/locations/nodes/", { params });
  return data;
}

export async function fetchLocationsByLevel(level: string, params: Record<string, string> = {}) {
  const { data } = await api.get(`/locations/${level}/`, { params });
  return data as any[];
}
