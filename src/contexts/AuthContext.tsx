import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole } from '@/types';
import { setAuthTokens, clearAuthTokens, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '@/services/api';
import * as authService from '@/services/authService';
import { mapBackendUser } from '@/services/mappers';

interface SendOtpResult {
  success: boolean;
  challengeId?: string;
  debugOtp?: string;
  error?: string;
}

interface AuthActionResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sendOtp: (email: string) => Promise<SendOtpResult>;
  verifyOtp: (email: string, otp: string, challengeId: string) => Promise<AuthActionResult>;
  loginWithPassword: (email: string, password: string) => Promise<AuthActionResult>;
  loginWithLogiconToken: (token: string) => Promise<AuthActionResult>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function extractApiError(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  return fallback;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const storeAuthenticatedUser = useCallback((rawUser: authService.BackendUser) => {
    const u = mapBackendUser(rawUser);
    setUser(u);
    sessionStorage.setItem('auth_user', JSON.stringify(u));
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      authService
        .fetchMe()
        .then(storeAuthenticatedUser)
        .catch(() => {
          clearAuthTokens();
          sessionStorage.removeItem('auth_user');
        })
        .finally(() => setIsLoading(false));
    } else {
      const saved = sessionStorage.getItem('auth_user');
      if (saved) {
        try { setUser(JSON.parse(saved)); } catch { /* ignore */ }
      }
      setIsLoading(false);
    }
  }, [storeAuthenticatedUser]);

  const sendOtp = useCallback(async (email: string): Promise<SendOtpResult> => {
    try {
      const resp = await authService.sendOtp(email);
      return {
        success: true,
        challengeId: resp.challenge_id,
        debugOtp: resp.debug_otp,
      };
    } catch (err: unknown) {
      return { success: false, error: extractApiError(err, 'Failed to send OTP.') };
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, otp: string, challengeId: string): Promise<AuthActionResult> => {
    try {
      const resp = await authService.verifyOtp(email, otp, challengeId);
      setAuthTokens(resp.access, resp.refresh);
      storeAuthenticatedUser(resp.user);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: extractApiError(err, 'Invalid OTP.') };
    }
  }, [storeAuthenticatedUser]);

  const loginWithPassword = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    try {
      const resp = await authService.loginWithPassword(email, password);
      setAuthTokens(resp.access, resp.refresh);
      storeAuthenticatedUser(resp.user);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: extractApiError(err, 'Invalid email or password.') };
    }
  }, [storeAuthenticatedUser]);

  const loginWithLogiconToken = useCallback(async (token: string): Promise<AuthActionResult> => {
    try {
      const resp = await authService.consumeLogiconSso(token);
      setAuthTokens(resp.access, resp.refresh);
      storeAuthenticatedUser(resp.user);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: extractApiError(err, 'Unable to open Asset Vault from Logicon.') };
    }
  }, [storeAuthenticatedUser]);

  const logout = useCallback(async () => {
    const refresh = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (refresh) {
      await authService.logout(refresh);
    } else {
      clearAuthTokens();
    }
    setUser(null);
    sessionStorage.removeItem('auth_user');
  }, []);

  const switchRole = useCallback((_role: UserRole) => {
    // No-op: role switching was demo-only
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, sendOtp, verifyOtp, loginWithPassword, loginWithLogiconToken, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
