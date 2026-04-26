"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/store/auth-store";

type User = {
  id: string;
  tenant_id?: string;
  name: string;
  email: string;
  role: "admin" | "secretaria" | "doctor";
};

export function DashboardSessionHydrator({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    setUser(user);
  }, [setUser, user]);

  return <>{children}</>;
}