import api, { clearAuthTokens } from "./api";

export interface SendOtpResponse {
  challenge_id: string;
  debug_otp?: string;
}

export interface VerifyOtpResponse {
  access: string;
  refresh: string;
  user: BackendUser;
}

export interface BackendUser {
  id: string;
  email: string;
  name: string;
  role: string;
  role_codes: string[];
  permission_codes: string[];
  locationId: string | null;
  locationName: string | null;
  assignedLocationIds: string[];
  is_global_scope: boolean;
}

export async function sendOtp(email: string): Promise<SendOtpResponse> {
  const { data } = await api.post("/auth/send-otp", { email });
  return data;
}

export async function verifyOtp(
  email: string,
  otp: string,
  challengeId: string,
): Promise<VerifyOtpResponse> {
  const { data } = await api.post("/auth/verify-otp", {
    email,
    otp,
    challenge_id: challengeId,
  });
  return data;
}

export async function fetchMe(): Promise<BackendUser> {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function logout(refreshToken: string): Promise<void> {
  try {
    await api.post("/auth/logout", { refresh: refreshToken });
  } catch {
    // Best-effort; clear tokens either way
  }
  clearAuthTokens();
}
