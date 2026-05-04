"use client";

import { create } from "zustand";

import { fetchJsonWithRetry } from "@/lib/http-client";

type SessionUser = {
  id: string;
  tenant_id?: string;
  name: string;
  email: string;
  role:
    | "super_admin"
    | "clinic_owner"
    | "clinic_admin"
    | "admin"
    | "secretaria"
    | "receptionist"
    | "recepcionista"
    | "doctor"
    | "medico"
    | "auditor"
    | "patient";
};

type AuthState = {
  user: SessionUser | null;
  loading: boolean;
  setUser: (user: SessionUser | null) => void;
  fetchMe: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  setUser: (user) => set({ user }),
  fetchMe: async () => {
    set({ loading: true });
    try {
      const user = await fetchJsonWithRetry<SessionUser>(
        "/api/auth/me",
        { cache: "no-store" },
        { retries: 1, timeoutMs: 8_000 },
      );

      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  logout: async () => {
    try {
      await fetchJsonWithRetry<{ revoked: boolean }>(
        "/api/auth/logout",
        { method: "POST" },
        { retries: 0, timeoutMs: 8_000 },
      );
    } catch {
      // En logout forzamos estado local aunque falle red
    }
    set({ user: null });
  },
}));
