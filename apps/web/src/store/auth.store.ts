'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  login: (accessToken: string, refreshToken: string, userId: string) => void;
  logout: () => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      isAuthenticated: false,
      login: (accessToken, refreshToken, userId) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          localStorage.setItem('userId', userId);
        }
        set({ accessToken, refreshToken, userId, isAuthenticated: true });
      },
      logout: () => {
        if (typeof window !== 'undefined') localStorage.clear();
        set({ accessToken: null, refreshToken: null, userId: null, isAuthenticated: false });
      },
      setAccessToken: (token) => {
        if (typeof window !== 'undefined') localStorage.setItem('accessToken', token);
        set({ accessToken: token });
      },
    }),
    {
      name: 'auth-store',
      partialize: (s) => ({ userId: s.userId, isAuthenticated: s.isAuthenticated }),
    },
  ),
);
