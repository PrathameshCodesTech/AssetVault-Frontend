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

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sendOtp: (email: string) => Promise<SendOtpResult>;
  verifyOtp: (email: string, otp: string, challengeId: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      authService
        .fetchMe()
        .then((raw) => {
          const u = mapBackendUser(raw);
          setUser(u);
          sessionStorage.setItem('auth_user', JSON.stringify(u));
        })
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
  }, []);

  const sendOtp = useCallback(async (email: string): Promise<SendOtpResult> => {
    try {
      const resp = await authService.sendOtp(email);
      return {
        success: true,
        challengeId: resp.challenge_id,
        debugOtp: resp.debug_otp,
      };
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? 'Failed to send OTP.';
      return { success: false, error: detail };
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, otp: string, challengeId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const resp = await authService.verifyOtp(email, otp, challengeId);
      setAuthTokens(resp.access, resp.refresh);
      const u = mapBackendUser(resp.user);
      setUser(u);
      sessionStorage.setItem('auth_user', JSON.stringify(u));
      return { success: true };
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? 'Invalid OTP.';
      return { success: false, error: detail };
    }
  }, []);

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
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, sendOtp, verifyOtp, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
